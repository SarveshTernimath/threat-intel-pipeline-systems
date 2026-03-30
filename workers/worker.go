package main

import (
	"bytes"
	"context"
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
				if esURL == "" {
					esURL = "http://localhost:9200"
				}
				fmt.Println("DEBUG: Using Elasticsearch URL:", esURL)

				esBaseUrl := esURL // Preserve for auth logic
				tempBase := strings.TrimRight(esURL, "/")
				esURL = fmt.Sprintf("%s/threats/_doc/%s", tempBase, threat.CVEID)

			cmd := exec.Command("python", "../nlp_service/entity_extractor.py")
			cmd.Stdin = strings.NewReader(threat.Description)
			var out bytes.Buffer
			cmd.Stdout = &out

			var enrichedMsg []byte = []byte(message)
			var displayKeywords []string
			var displayAttackType string
			displaySeverity := "unknown"
			var displayIOCs interface{}

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
					displayKeywords = nlpResult.Keywords
					displayAttackType = nlpResult.AttackType
					displayIOCs = nlpResult.IOCs

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
						displaySeverity = severity
						threatMap["severity"] = severity

						if marshaled, err := json.Marshal(threatMap); err == nil {
							enrichedMsg = marshaled
						}
					}
				}
			} else {
				log.Printf("NLP script error: %v, Output: %s", err, out.String())
			}

			fmt.Printf("--- New Threat Record ---\n")
			fmt.Printf("Source:         %s\n", threat.Source)
			fmt.Printf("CVE ID:         %s\n", threat.CVEID)
			fmt.Printf("Description:    %s\n", threat.Description)
			fmt.Printf("Published Date: %s\n", threat.PublishedDate)
			fmt.Printf("Keywords:       %v\n", displayKeywords)
			fmt.Printf("Attack Type:    %s\n", displayAttackType)
			fmt.Printf("Severity:       %s\n", displaySeverity)
			fmt.Printf("IOCs:           %+v\n", displayIOCs)
			fmt.Println()

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
			resp, err := client.Do(req)
			if err != nil {
				log.Printf("Error indexing threat to Elasticsearch: %v", err)
				return
			}
			defer resp.Body.Close()

			fmt.Printf("DEBUG: ES Indexing Status: %d (%s)\n", resp.StatusCode, resp.Status)
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				fmt.Printf("Indexed threat: %s\n", threat.CVEID)
			} else {
				respBody, _ := io.ReadAll(resp.Body)
				log.Printf("Failed to index threat. Status: %s, Response: %s", resp.Status, string(respBody))
			}
			}(message)
		}
	}
	wg.Wait()
}
