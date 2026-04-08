package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type ThreatRecord struct {
	Source        string `json:"source"`
	CVEID         string `json:"cve_id"`
	Description   string `json:"description"`
	PublishedDate string `json:"published_date"`
}

var (
	ipRegex  = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	cveRegex = regexp.MustCompile(`\bCVE-\d{4}-\d{4,7}\b`)
	domRegex = regexp.MustCompile(`\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b`)
)

func extractIndicators(text string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, 32)
	add := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}

	for _, m := range cveRegex.FindAllString(text, -1) {
		add(m)
	}
	for _, m := range ipRegex.FindAllString(text, -1) {
		add(m)
	}
	for _, m := range domRegex.FindAllString(text, -1) {
		m = strings.Trim(m, ".,;:()[]{}<>\"'")
		if strings.Count(m, ".") >= 1 && !strings.Contains(m, "..") {
			add(m)
		}
	}
	return out
}

type ipAPIResponse struct {
	Status  string  `json:"status"`
	Country string  `json:"country"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
}

func enrichGeoFromIP(ip string) (lat float64, lon float64, country string, ok bool) {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return 0, 0, "", false
	}
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequest("GET", fmt.Sprintf("http://ip-api.com/json/%s", ip), nil)
	if err != nil {
		return 0, 0, "", false
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return 0, 0, "", false
	}
	var parsed ipAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return 0, 0, "", false
	}
	if strings.ToLower(parsed.Status) != "success" {
		return 0, 0, "", false
	}
	return parsed.Lat, parsed.Lon, parsed.Country, true
}

func riskScoreForSeverity(severity string) int {
	switch strings.ToLower(strings.TrimSpace(severity)) {
	case "critical":
		return 90
	case "high":
		return 70
	case "medium":
		return 50
	case "low":
		return 20
	default:
		return 20
	}
}

func dedupeKeywordsLower(keywords []string) []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, len(keywords))
	for _, k := range keywords {
		k = strings.TrimSpace(strings.ToLower(k))
		if k == "" {
			continue
		}
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, k)
	}
	return out
}

// augmentKeywordsFromDescription merges NLP keywords with lightweight text hints (deduped, lowercased).
func augmentKeywordsFromDescription(descLower string, base []string) []string {
	kws := append([]string(nil), base...)
	if strings.Contains(descLower, "sql injection") {
		kws = append(kws, "sql", "injection")
	}
	if strings.Contains(descLower, "xss") || strings.Contains(descLower, "cross-site scripting") {
		kws = append(kws, "xss")
	}
	if strings.Contains(descLower, "rce") || strings.Contains(descLower, "remote code execution") {
		kws = append(kws, "rce")
	}
	if strings.Contains(descLower, "malware") {
		kws = append(kws, "malware")
	}
	if strings.Contains(descLower, "phishing") {
		kws = append(kws, "phishing")
	}
	if strings.Contains(descLower, "ransomware") {
		kws = append(kws, "ransomware")
	}
	if strings.Contains(descLower, "sqli") {
		kws = append(kws, "sqli")
	}
	if strings.Contains(descLower, "csrf") {
		kws = append(kws, "csrf")
	}
	if strings.Contains(descLower, "ssrf") {
		kws = append(kws, "ssrf")
	}
	if strings.Contains(descLower, "buffer overflow") {
		kws = append(kws, "buffer", "overflow")
	}
	if len(kws) == 0 {
		kws = append(kws, "threat")
	}
	return dedupeKeywordsLower(kws)
}

// enrichAttackTypeFromDescription maps common patterns to pipeline attack_type labels (does not alter Redis/queue payloads).
func enrichAttackTypeFromDescription(descLower string, fallback string) string {
	if strings.Contains(descLower, "phishing") {
		return "phishing"
	}
	if strings.Contains(descLower, "sql injection") || strings.Contains(descLower, "sqli") ||
		(strings.Contains(descLower, "sql") && strings.Contains(descLower, "inject")) {
		return "injection"
	}
	if strings.Contains(descLower, "cross-site scripting") || strings.Contains(descLower, "xss") {
		return "web attack"
	}
	if strings.Contains(descLower, "remote code execution") || strings.Contains(descLower, "remote execution") ||
		strings.Contains(descLower, "rce") {
		return "remote execution"
	}
	if strings.TrimSpace(fallback) != "" {
		return fallback
	}
	return "unknown"
}

func main() {
	ctx := context.Background()

	// Connect to Redis — use REDIS_URL env var (Upstash) or fallback to local
	redisURL := os.Getenv("REDIS_URL")
	var rdb *redis.Client
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Fatalf("Invalid REDIS_URL: %v", err)
		}
		rdb = redis.NewClient(opt)
	} else {
		rdb = redis.NewClient(&redis.Options{
			Addr:     "localhost:6379",
			Password: "",
			DB:       0,
		})
	}

	// Test connection with robust retry to handle network drops cleanly
	for {
		_, err := rdb.Ping(ctx).Result()
		if err == nil {
			break
		}
		log.Printf("Could not connect to Redis (%v). Retrying in 5 seconds...", err)
		time.Sleep(5 * time.Second)
	}

	fmt.Println("Worker connected to Redis. Listening on 'threat_queue'...")

	var wg sync.WaitGroup

	for {
		// BLPOP on threat_queue with 0 timeout (block indefinitely)
		result, err := rdb.BLPop(ctx, 0, "threat_queue").Result()
		if err != nil {
			log.Printf("Error reading from Redis: %v. Retrying in 5 seconds...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		// BLPOP returns a slice with length 2: [queue_name, popped_value]
		if len(result) == 2 {
			message := result[1]

			wg.Add(1)
			go func(message string) {
				defer wg.Done()

				var threat ThreatRecord
				err := json.Unmarshal([]byte(message), &threat)
				if err != nil {
					log.Printf("Error parsing JSON: %v", err)
					log.Printf("Raw message: %s", message)
					return
				}

				esURL := os.Getenv("ELASTICSEARCH_URL")
				esURL = strings.TrimSpace(esURL)
				if esURL == "" {
					esURL = "http://localhost:9200"
				}

				esBaseUrl := esURL // Preserve for auth logic
				tempBase := strings.TrimRight(esURL, "/")
				// Prevent overwrite by guaranteeing a unique doc id (original_id + timestamp)
				docID := fmt.Sprintf("%s-%d", threat.CVEID, time.Now().UnixMilli())
				esURL = fmt.Sprintf("%s/threats/_doc/%s", tempBase, docID)

				cmd := exec.Command("python", "../nlp_service/entity_extractor.py")
				cmd.Stdin = strings.NewReader(threat.Description)
				var out bytes.Buffer
				cmd.Stdout = &out

				var enrichedMsg []byte = []byte(message)
				if err := cmd.Run(); err == nil {
					type IOCs struct {
						IPs         []string      `json:"ips"`
						EnrichedIPs []interface{} `json:"enriched_ips"`
						Domains     []string      `json:"domains"`
						Hashes      []string      `json:"hashes"`
					}
					var nlpResult struct {
						Keywords   []string `json:"keywords"`
						AttackType string   `json:"attack_type"`
						IOCs       IOCs     `json:"iocs"`
					}
					if err := json.Unmarshal(out.Bytes(), &nlpResult); err == nil {

						// Execute Semantic API logic appending the sentence embeddings silently
						var denseVector []float32
						cmdEmbed := exec.Command("python", "../nlp_service/embedding_model.py")
						cmdEmbed.Stdin = strings.NewReader(threat.Description)
						if outEmbed, err := cmdEmbed.Output(); err == nil {
							var embedResult struct {
								Embedding []float32 `json:"embedding"`
							}
							// Silently map if successfully produced
							if json.Unmarshal(outEmbed, &embedResult) == nil {
								denseVector = embedResult.Embedding
							}
						}

						var threatMap map[string]interface{}
						if err := json.Unmarshal([]byte(message), &threatMap); err == nil {
							descLower := strings.ToLower(threat.Description)
							nlpResult.Keywords = augmentKeywordsFromDescription(descLower, nlpResult.Keywords)
							attackType := enrichAttackTypeFromDescription(descLower, nlpResult.AttackType)

							threatMap["keywords"] = nlpResult.Keywords
							threatMap["attack_type"] = attackType
							threatMap["iocs"] = nlpResult.IOCs
							indicators := extractIndicators(threat.Description)
							threatMap["indicators"] = indicators

							for _, indicator := range indicators {
								parsedIP := net.ParseIP(indicator)
								if parsedIP != nil {
									nlpResult.IOCs.IPs = append(nlpResult.IOCs.IPs, indicator)
								} else if domRegex.MatchString(indicator) {
									resolvedIPs, err := net.LookupIP(indicator)
									if err == nil && len(resolvedIPs) > 0 {
										nlpResult.IOCs.IPs = append(nlpResult.IOCs.IPs, resolvedIPs[0].String())
									}
								}
							}
							threatMap["iocs"] = nlpResult.IOCs

							// Append AI vector natively
							if len(denseVector) > 0 {
								threatMap["embedding"] = denseVector
							}

							// Calculate severity natively without touching python models
							severity := "medium"
							if len(nlpResult.Keywords) == 0 {
								severity = "low"
							} else {
								hasMalware, hasRansomware := false, false
								for _, kw := range nlpResult.Keywords {
									if kw == "malware" {
										hasMalware = true
									} else if kw == "ransomware" {
										hasRansomware = true
									}
								}
								isSQLi := strings.Contains(descLower, "sql injection") || strings.Contains(descLower, "sqli")
								for _, kw := range nlpResult.Keywords {
									if kw == "rce" || kw == "remote code execution" || kw == "sql injection" || isSQLi || (hasMalware && hasRansomware) {
										severity = "critical"
									} else if kw == "buffer overflow" && severity != "critical" {
										severity = "high"
									} else if kw == "xss" && severity != "critical" && severity != "high" {
										severity = "medium"
									}
								}
								if strings.Contains(descLower, "buffer overflow") && severity != "critical" {
									severity = "high"
								}
							}
							threatMap["severity"] = severity
							threatMap["risk_score"] = riskScoreForSeverity(severity)

							// REAL Geo enrichment (no mock): only if we have a valid IP in iocs.ips
							if len(nlpResult.IOCs.IPs) > 0 {
								if lat, lon, country, okGeo := enrichGeoFromIP(nlpResult.IOCs.IPs[0]); okGeo {
									threatMap["lat"] = lat
									threatMap["lng"] = lon
									threatMap["country"] = country
								}
							}

							if marshaled, err := json.Marshal(threatMap); err == nil {
								enrichedMsg = marshaled
							}
						}
					}
				} else {
					log.Printf("NLP script error: %v, Output: %s", err, out.String())
				}

				req, err := http.NewRequest("PUT", esURL, bytes.NewBuffer(enrichedMsg))
				if err != nil {
					log.Printf("Error creating ES request: %v", err)
					return
				}
				req.Header.Set("Content-Type", "application/json")

				// Inject basic auth from URL if provided
				if parsedURL, parseErr := url.Parse(esBaseUrl); parseErr == nil && parsedURL.User != nil {
					if password, ok := parsedURL.User.Password(); ok {
						req.SetBasicAuth(parsedURL.User.Username(), password)
					}
				}

				client := &http.Client{}

				// Bypass self-signed SSL verification strictly for local testing to avoid x509 errors
				if strings.HasPrefix(esBaseUrl, "https://localhost") || strings.HasPrefix(esBaseUrl, "https://127.0.0.1") {
					client.Transport = &http.Transport{
						TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
					}
				}

				// PRE-INDEX REACHABILITY CHECK
				pingReq, _ := http.NewRequest("GET", esBaseUrl, nil)
				if parsedURL, parseErr := url.Parse(esBaseUrl); parseErr == nil && parsedURL.User != nil {
					if password, ok := parsedURL.User.Password(); ok {
						pingReq.SetBasicAuth(parsedURL.User.Username(), password)
					}
				}
				respPing, errPing := client.Do(pingReq)
				if errPing != nil {
					log.Printf("Error: Elasticsearch at %s is unreachable (%v). Request skipped.", esBaseUrl, errPing)
					return
				}
				if respPing != nil {
					respPing.Body.Close()
				}

				resp, err := client.Do(req)
				if err != nil {
					log.Printf("Error indexing threat to Elasticsearch: %v", err)
					return
				}
				defer resp.Body.Close()

				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					log.Printf("Successfully indexed threat: %s", threat.CVEID)
				} else {
					respBody, _ := io.ReadAll(resp.Body)
					log.Printf("Failed to index threat. Status: %s, Response: %s", resp.Status, string(respBody))
				}
			}(message)
		}
	}
	wg.Wait()
}
