package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/redis/go-redis/v9"
)

type ThreatRecord struct {
	Source        string `json:"source"`
	CVEID         string `json:"cve_id"`
	Description   string `json:"description"`
	PublishedDate string `json:"published_date"`
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

	// Test connection
	_, err := rdb.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
	}

	fmt.Println("Worker connected to Redis. Listening on 'threat_queue'...")

	var wg sync.WaitGroup

	for {
		// BLPOP on threat_queue with 0 timeout (block indefinitely)
		result, err := rdb.BLPop(ctx, 0, "threat_queue").Result()
		if err != nil {
			log.Printf("Error reading from Redis: %v", err)
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
				esURL = fmt.Sprintf("%s/threats/_doc/%s", tempBase, threat.CVEID)

			cmd := exec.Command("python", "../nlp_service/entity_extractor.py")
			cmd.Stdin = strings.NewReader(threat.Description)
			var out bytes.Buffer
			cmd.Stdout = &out

			var enrichedMsg []byte = []byte(message)
			if err := cmd.Run(); err == nil {
				type IOCs struct {
					IPs     []string `json:"ips"`
					Domains []string `json:"domains"`
					Hashes  []string `json:"hashes"`
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
						if strings.Contains(descLower, "sql injection") {
							nlpResult.Keywords = append(nlpResult.Keywords, "sql", "injection")
						}
						if strings.Contains(descLower, "xss") || strings.Contains(descLower, "cross-site scripting") {
							nlpResult.Keywords = append(nlpResult.Keywords, "xss")
						}
						if strings.Contains(descLower, "rce") {
							nlpResult.Keywords = append(nlpResult.Keywords, "rce")
						}
						if strings.Contains(descLower, "malware") {
							nlpResult.Keywords = append(nlpResult.Keywords, "malware")
						}
						if len(nlpResult.Keywords) == 0 {
							nlpResult.Keywords = append(nlpResult.Keywords, "threat")
						}

						threatMap["keywords"] = nlpResult.Keywords
						threatMap["attack_type"] = nlpResult.AttackType
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
							
							for _, kw := range nlpResult.Keywords {
								if kw == "rce" || kw == "remote code execution" || kw == "sql injection" || (hasMalware && hasRansomware) {
									severity = "critical"
								} else if kw == "buffer overflow" && severity != "critical" {
									severity = "high"
								} else if kw == "xss" && severity != "critical" && severity != "high" {
									severity = "medium"
								}
							}
						}
						threatMap["severity"] = severity

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
