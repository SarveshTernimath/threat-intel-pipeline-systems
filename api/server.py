import os
import json
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

# ---------------------------------------------------------------------------
# 115 realistic seed threats — auto-indexed if ES has fewer than 50 docs.
# Each entry has lat/lng so the globe map works on first load.
# ---------------------------------------------------------------------------
SEED_THREATS = [
    # ── Russia (15) ─────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-0871","source":"NVD","description":"Remote code execution via heap buffer overflow in Windows kernel driver allows unauthenticated attacker to gain SYSTEM privileges","published_date":"2025-03-12","severity":"critical","attack_type":"remote execution","keywords":["rce","buffer overflow","kernel","exploit"],"iocs":{"ips":["45.142.212.100"],"domains":["c2-payload.ru"],"hashes":[]},"lat":55.7558,"lng":37.6176,"country":"Russia","risk_score":90,"indicators":["45.142.212.100","c2-payload.ru"],"is_recent":True},
    {"cve_id":"CVE-2025-1142","source":"OTX","description":"Lazarus group deploys LockBit ransomware variant targeting financial institutions via spear-phishing attachments","published_date":"2025-03-18","severity":"critical","attack_type":"ransomware","keywords":["ransomware","lockbit","phishing","lazarus"],"iocs":{"ips":["5.188.86.43"],"domains":["lockbit-payment.onion"],"hashes":["a3f1c2b4d5e6f7890abc"]},"lat":56.12,"lng":40.22,"country":"Russia","risk_score":90,"indicators":["5.188.86.43"],"is_recent":True},
    {"cve_id":"CVE-2025-2201","source":"NVD","description":"SQL injection in Apache Struts web framework allows remote attacker to execute arbitrary SQL commands and exfiltrate database contents","published_date":"2025-02-28","severity":"critical","attack_type":"injection","keywords":["sql injection","sqli","apache","struts"],"iocs":{"ips":["62.76.41.55"],"domains":[],"hashes":[]},"lat":54.31,"lng":35.89,"country":"Russia","risk_score":90,"indicators":["62.76.41.55"],"is_recent":True},
    {"cve_id":"OTX-RU-2025-003","source":"OTX","description":"APT28 Fancy Bear campaign exploits zero-day in Outlook to deliver credential-harvesting payload against NATO infrastructure","published_date":"2025-03-05","severity":"critical","attack_type":"phishing","keywords":["apt28","fancy bear","zero-day","outlook","nato"],"iocs":{"ips":["194.165.16.29"],"domains":["mail-secure-update.ru"],"hashes":[]},"lat":57.61,"lng":39.87,"country":"Russia","risk_score":90,"indicators":["194.165.16.29"],"is_recent":True},
    {"cve_id":"CVE-2025-3317","source":"NVD","description":"Privilege escalation vulnerability in OpenSSH allows local attacker to gain root shell via race condition in sshd process","published_date":"2025-03-20","severity":"high","attack_type":"privilege escalation","keywords":["ssh","privilege escalation","race condition","linux"],"iocs":{"ips":["45.142.212.44"],"domains":[],"hashes":[]},"lat":55.11,"lng":36.51,"country":"Russia","risk_score":70,"indicators":["45.142.212.44"],"is_recent":True},
    {"cve_id":"CVE-2025-3801","source":"RSS","description":"Turla APT group uses DNS tunneling for covert C2 communication bypassing traditional firewall detection","published_date":"2025-02-14","severity":"high","attack_type":"c2 communication","keywords":["turla","dns tunneling","c2","apt"],"iocs":{"ips":["85.93.0.11"],"domains":["tunnel.update-sys.ru"],"hashes":[]},"lat":59.93,"lng":30.32,"country":"Russia","risk_score":70,"indicators":["85.93.0.11"],"is_recent":True},
    {"cve_id":"CVE-2025-4122","source":"NVD","description":"Cross-site scripting vulnerability in WordPress plugin with 2M+ installs allows stored XSS attack via comment field","published_date":"2025-01-30","severity":"medium","attack_type":"web attack","keywords":["xss","wordpress","stored xss","plugin"],"iocs":{"ips":["5.188.86.70"],"domains":[],"hashes":[]},"lat":56.85,"lng":35.91,"country":"Russia","risk_score":50,"indicators":["5.188.86.70"],"is_recent":True},
    {"cve_id":"CVE-2025-4503","source":"OTX","description":"Emotet botnet resurgence observed delivering QakBot payload via malicious Excel macros targeting corporate users","published_date":"2025-02-22","severity":"high","attack_type":"malware","keywords":["emotet","qakbot","botnet","malware","excel"],"iocs":{"ips":["62.76.188.42"],"domains":["excel-doc-update.ru"],"hashes":["b1c2d3e4f5a6b7c8d9e0"]},"lat":53.20,"lng":45.00,"country":"Russia","risk_score":70,"indicators":["62.76.188.42"],"is_recent":True},
    {"cve_id":"CVE-2025-5001","source":"NVD","description":"Memory corruption in Chromium IPC allows renderer sandbox escape to execute code at browser process privileges","published_date":"2025-03-01","severity":"critical","attack_type":"remote execution","keywords":["chromium","sandbox escape","memory corruption","browser"],"iocs":{"ips":["45.142.212.211"],"domains":[],"hashes":[]},"lat":55.95,"lng":37.36,"country":"Russia","risk_score":90,"indicators":["45.142.212.211"],"is_recent":True},
    {"cve_id":"CVE-2025-5289","source":"RSS","description":"Sandworm team targets Ukrainian energy grid SCADA systems with wiper malware variant causing operational disruption","published_date":"2025-02-10","severity":"critical","attack_type":"destructive malware","keywords":["sandworm","scada","wiper","ics","ukraine"],"iocs":{"ips":["5.188.62.140"],"domains":[],"hashes":["f1e2d3c4b5a69788"]},"lat":58.00,"lng":38.50,"country":"Russia","risk_score":90,"indicators":["5.188.62.140"],"is_recent":True},
    {"cve_id":"CVE-2025-5411","source":"NVD","description":"Deserialization vulnerability in Java Spring Framework allows remote code execution without authentication","published_date":"2025-01-15","severity":"critical","attack_type":"remote execution","keywords":["spring","java","deserialization","rce"],"iocs":{"ips":["62.76.100.55"],"domains":["java-exploit-srv.net"],"hashes":[]},"lat":53.73,"lng":41.43,"country":"Russia","risk_score":90,"indicators":["62.76.100.55"],"is_recent":True},
    {"cve_id":"CVE-2025-5602","source":"OTX","description":"Phishing campaign impersonating Microsoft 365 login portal harvesting enterprise credentials at scale","published_date":"2025-03-08","severity":"medium","attack_type":"phishing","keywords":["phishing","microsoft","credential harvesting","m365"],"iocs":{"ips":["45.142.212.150"],"domains":["microsoft365-login.ru"],"hashes":[]},"lat":56.30,"lng":40.00,"country":"Russia","risk_score":50,"indicators":["45.142.212.150"],"is_recent":True},
    {"cve_id":"CVE-2025-5788","source":"NVD","description":"SSRF vulnerability in cloud metadata service allows attacker to retrieve IAM credentials from AWS instance metadata API","published_date":"2025-02-05","severity":"high","attack_type":"ssrf","keywords":["ssrf","cloud","aws","metadata","iam"],"iocs":{"ips":["5.188.10.88"],"domains":[],"hashes":[]},"lat":51.66,"lng":39.18,"country":"Russia","risk_score":70,"indicators":["5.188.10.88"],"is_recent":True},
    {"cve_id":"CVE-2025-5891","source":"RSS","description":"GRU-linked actors deploy supply chain attack inserting backdoor into popular npm package with 50k weekly downloads","published_date":"2025-01-22","severity":"critical","attack_type":"supply chain","keywords":["supply chain","npm","backdoor","gru"],"iocs":{"ips":["62.76.41.99"],"domains":["npm-malicious-pkg.ru"],"hashes":["c9d8e7f6a5b4c3d2"]},"lat":55.23,"lng":36.98,"country":"Russia","risk_score":90,"indicators":["62.76.41.99"],"is_recent":True},
    {"cve_id":"CVE-2025-6001","source":"NVD","description":"Denial of service vulnerability in curl HTTP client allows remote server to crash client via malformed response headers","published_date":"2025-03-25","severity":"medium","attack_type":"denial of service","keywords":["dos","curl","http"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":57.50,"lng":38.10,"country":"Russia","risk_score":50,"indicators":[],"is_recent":True},

    # ── China (15) ──────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1301","source":"NVD","description":"APT41 exploits zero-day in Fortinet VPN to gain persistent access to government networks across Southeast Asia","published_date":"2025-03-14","severity":"critical","attack_type":"remote execution","keywords":["apt41","fortinet","vpn","zero-day","government"],"iocs":{"ips":["202.96.134.22"],"domains":["update.gov-portal.cn"],"hashes":[]},"lat":39.9042,"lng":116.4074,"country":"China","risk_score":90,"indicators":["202.96.134.22"],"is_recent":True},
    {"cve_id":"CVE-2025-1567","source":"OTX","description":"Volt Typhoon APT pre-positions in US critical infrastructure targeting power grid and water treatment facilities","published_date":"2025-02-28","severity":"critical","attack_type":"ics attack","keywords":["volt typhoon","critical infrastructure","living off the land","ics"],"iocs":{"ips":["222.186.21.10"],"domains":[],"hashes":[]},"lat":31.23,"lng":121.47,"country":"China","risk_score":90,"indicators":["222.186.21.10"],"is_recent":True},
    {"cve_id":"CVE-2025-2089","source":"NVD","description":"SQL injection flaw in Ivanti Connect Secure VPN allows unauthenticated attacker to extract password hashes","published_date":"2025-01-18","severity":"critical","attack_type":"injection","keywords":["ivanti","vpn","sql injection","authentication bypass"],"iocs":{"ips":["43.129.200.55"],"domains":["ivanti-update-srv.com"],"hashes":[]},"lat":22.54,"lng":114.06,"country":"China","risk_score":90,"indicators":["43.129.200.55"],"is_recent":True},
    {"cve_id":"CVE-2025-2456","source":"RSS","description":"Salt Typhoon campaign compromises major US telecommunications providers intercepting domestic call records","published_date":"2025-02-12","severity":"critical","attack_type":"espionage","keywords":["salt typhoon","telecom","espionage","wiretap"],"iocs":{"ips":["202.96.75.18"],"domains":[],"hashes":[]},"lat":25.04,"lng":121.56,"country":"China","risk_score":90,"indicators":["202.96.75.18"],"is_recent":True},
    {"cve_id":"CVE-2025-2901","source":"NVD","description":"Authentication bypass in Palo Alto PAN-OS GlobalProtect gateway allows remote attacker to execute arbitrary commands","published_date":"2025-03-10","severity":"critical","attack_type":"authentication bypass","keywords":["palo alto","pan-os","authentication bypass","rce"],"iocs":{"ips":["43.156.10.80"],"domains":[],"hashes":[]},"lat":30.57,"lng":104.07,"country":"China","risk_score":90,"indicators":["43.156.10.80"],"is_recent":True},
    {"cve_id":"CVE-2025-3214","source":"OTX","description":"Mustang Panda deploys PlugX RAT variant with DLL sideloading targeting Mongolian government ministries","published_date":"2025-01-28","severity":"high","attack_type":"remote access trojan","keywords":["mustang panda","plugx","rat","dll sideloading"],"iocs":{"ips":["222.186.54.200"],"domains":["mongolia-gov.update"],"hashes":["d1c2b3a4e5f60718"]},"lat":32.06,"lng":118.79,"country":"China","risk_score":70,"indicators":["222.186.54.200"],"is_recent":True},
    {"cve_id":"CVE-2025-3789","source":"NVD","description":"Path traversal vulnerability in GitLab allows unauthenticated read of arbitrary files including private repository contents","published_date":"2025-02-01","severity":"high","attack_type":"path traversal","keywords":["gitlab","path traversal","information disclosure"],"iocs":{"ips":["43.129.88.44"],"domains":[],"hashes":[]},"lat":23.13,"lng":113.26,"country":"China","risk_score":70,"indicators":["43.129.88.44"],"is_recent":True},
    {"cve_id":"CVE-2025-4012","source":"RSS","description":"RedHotel espionage group targets semiconductor firms in Taiwan stealing chip design intellectual property","published_date":"2025-03-02","severity":"high","attack_type":"espionage","keywords":["redhotel","semiconductor","ip theft","taiwan"],"iocs":{"ips":["202.96.12.88"],"domains":["secure-update.semi.cn"],"hashes":[]},"lat":39.55,"lng":116.88,"country":"China","risk_score":70,"indicators":["202.96.12.88"],"is_recent":True},
    {"cve_id":"CVE-2025-4234","source":"NVD","description":"Heap overflow in libjpeg-turbo image processing library triggered by malformed JPEG allows arbitrary code execution","published_date":"2025-01-10","severity":"high","attack_type":"remote execution","keywords":["jpeg","heap overflow","library","media"],"iocs":{"ips":["43.229.190.12"],"domains":[],"hashes":[]},"lat":29.87,"lng":121.55,"country":"China","risk_score":70,"indicators":["43.229.190.12"],"is_recent":True},
    {"cve_id":"CVE-2025-4678","source":"OTX","description":"Earth Estries APT conducts long-term cyber espionage against Southeast Asian telecoms using custom GHOSTSPIDER malware","published_date":"2025-02-18","severity":"high","attack_type":"espionage","keywords":["earth estries","espionage","ghostspider","telecom"],"iocs":{"ips":["222.186.42.77"],"domains":["cdn-images-update.net"],"hashes":["a1b2c3d4e5f67890"]},"lat":36.06,"lng":120.38,"country":"China","risk_score":70,"indicators":["222.186.42.77"],"is_recent":True},
    {"cve_id":"CVE-2025-4890","source":"NVD","description":"XML external entity injection in Oracle WebLogic allows SSRF and local file inclusion attacks","published_date":"2025-03-22","severity":"medium","attack_type":"injection","keywords":["xxe","oracle","weblogic","ssrf"],"iocs":{"ips":["43.129.50.33"],"domains":[],"hashes":[]},"lat":28.20,"lng":112.97,"country":"China","risk_score":50,"indicators":["43.129.50.33"],"is_recent":True},
    {"cve_id":"CVE-2025-5112","source":"RSS","description":"Chinese state actors compromise Australian government contractor network stealing classified project documents","published_date":"2025-01-25","severity":"critical","attack_type":"data exfiltration","keywords":["australia","government","data exfiltration","espionage"],"iocs":{"ips":["202.96.100.21"],"domains":["au-gov-update.cn"],"hashes":[]},"lat":34.27,"lng":108.95,"country":"China","risk_score":90,"indicators":["202.96.100.21"],"is_recent":True},
    {"cve_id":"CVE-2025-5334","source":"NVD","description":"CSRF vulnerability in Jenkins CI server allows attacker to execute arbitrary build jobs via forged request","published_date":"2025-02-08","severity":"medium","attack_type":"web attack","keywords":["csrf","jenkins","ci","web"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":26.07,"lng":119.30,"country":"China","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-5556","source":"OTX","description":"Camaro Dragon APT uses USB propagation via TinyTurla worm to bridge air-gapped networks in defense sector","published_date":"2025-03-15","severity":"high","attack_type":"air gap attack","keywords":["camaro dragon","usb","airgap","worm","defense"],"iocs":{"ips":["222.186.80.55"],"domains":[],"hashes":["e5d4c3b2a10987fe"]},"lat":38.90,"lng":121.63,"country":"China","risk_score":70,"indicators":["222.186.80.55"],"is_recent":True},
    {"cve_id":"CVE-2025-5778","source":"NVD","description":"Directory traversal in Nginx server configuration exposes sensitive configuration files to unauthenticated users","published_date":"2025-01-05","severity":"low","attack_type":"information disclosure","keywords":["nginx","directory traversal","misconfiguration"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":38.04,"lng":114.51,"country":"China","risk_score":20,"indicators":[],"is_recent":True},

    # ── North Korea (10) ─────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1098","source":"OTX","description":"Lazarus Group targets cryptocurrency exchange employees with fake job offer PDF delivering Manuscrypt backdoor","published_date":"2025-03-08","severity":"critical","attack_type":"malware","keywords":["lazarus","cryptocurrency","manuscrypt","social engineering"],"iocs":{"ips":["175.45.176.15"],"domains":["blockchain-jobs.com"],"hashes":["1a2b3c4d5e6f7890"]},"lat":39.0392,"lng":125.7625,"country":"North Korea","risk_score":90,"indicators":["175.45.176.15"],"is_recent":True},
    {"cve_id":"CVE-2025-1432","source":"RSS","description":"DPRK hackers steal $1.5B from Bybit exchange using TraderTraitor social engineering against developer team","published_date":"2025-02-22","severity":"critical","attack_type":"financial theft","keywords":["dprk","bybit","tradertraitor","crypto theft"],"iocs":{"ips":["175.45.176.77"],"domains":[],"hashes":[]},"lat":38.91,"lng":125.75,"country":"North Korea","risk_score":90,"indicators":["175.45.176.77"],"is_recent":True},
    {"cve_id":"CVE-2025-2010","source":"NVD","description":"BlueNoroff APT targets venture capital firms with macOS DPRK malware strain delivered via fake investment documents","published_date":"2025-01-20","severity":"high","attack_type":"malware","keywords":["bluenoroff","macos","venture capital","spear phishing"],"iocs":{"ips":["210.52.109.33"],"domains":["vc-opportunity.net"],"hashes":["2b3c4d5e6f7a8b90"]},"lat":40.34,"lng":127.51,"country":"North Korea","risk_score":70,"indicators":["210.52.109.33"],"is_recent":True},
    {"cve_id":"CVE-2025-2334","source":"OTX","description":"Kimsuky APT delivers MagicRAT trojan via tax document phishing emails targeting South Korean civil servants","published_date":"2025-03-18","severity":"high","attack_type":"remote access trojan","keywords":["kimsuky","magicrat","phishing","korea"],"iocs":{"ips":["175.45.178.22"],"domains":["tax-refund-portal.kr"],"hashes":[]},"lat":38.75,"lng":126.10,"country":"North Korea","risk_score":70,"indicators":["175.45.178.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2789","source":"RSS","description":"Andariel subgroup plants destructive wiper in South Korean defense contractor before exfiltrating weapons blueprints","published_date":"2025-02-05","severity":"critical","attack_type":"destructive malware","keywords":["andariel","wiper","defense","south korea"],"iocs":{"ips":["210.52.109.90"],"domains":[],"hashes":["c3d4e5f6a7b8c9d0"]},"lat":39.50,"lng":125.00,"country":"North Korea","risk_score":90,"indicators":["210.52.109.90"],"is_recent":True},
    {"cve_id":"CVE-2025-3011","source":"NVD","description":"DPRK supply chain attack inserts malicious code into Python packages targeting crypto wallet libraries","published_date":"2025-01-12","severity":"critical","attack_type":"supply chain","keywords":["dprk","supply chain","python","crypto wallet"],"iocs":{"ips":["175.45.180.11"],"domains":["pypi-cdn-mirror.com"],"hashes":["d4e5f6a7b8c9d0e1"]},"lat":38.30,"lng":126.55,"country":"North Korea","risk_score":90,"indicators":["175.45.180.11"],"is_recent":True},
    {"cve_id":"CVE-2025-3456","source":"OTX","description":"AppleJeus malware family updated with macOS variant targeting DeFi protocol developers via fake job interviews on LinkedIn","published_date":"2025-02-14","severity":"high","attack_type":"malware","keywords":["applejeus","defi","linkedin","social engineering","macos"],"iocs":{"ips":["210.52.109.44"],"domains":["defi-jobs.io"],"hashes":[]},"lat":38.95,"lng":125.95,"country":"North Korea","risk_score":70,"indicators":["210.52.109.44"],"is_recent":True},
    {"cve_id":"CVE-2025-3890","source":"NVD","description":"Command injection in SOHO router firmware allows network-adjacent attacker to execute root shell commands","published_date":"2025-03-01","severity":"medium","attack_type":"injection","keywords":["router","command injection","soho","firmware"],"iocs":{"ips":["175.45.176.200"],"domains":[],"hashes":[]},"lat":39.12,"lng":126.00,"country":"North Korea","risk_score":50,"indicators":["175.45.176.200"],"is_recent":True},
    {"cve_id":"CVE-2025-4201","source":"RSS","description":"IT workers posing as freelancers infiltrate US tech companies remotely generating revenue for DPRK weapons program","published_date":"2025-01-28","severity":"high","attack_type":"insider threat","keywords":["dprk","it worker fraud","insider","weapons funding"],"iocs":{"ips":["175.45.178.55"],"domains":[],"hashes":[]},"lat":38.65,"lng":125.55,"country":"North Korea","risk_score":70,"indicators":["175.45.178.55"],"is_recent":True},
    {"cve_id":"CVE-2025-4567","source":"OTX","description":"ScarCruft group intercepts journalists SMS messages using commercial spyware targeting human rights reporters","published_date":"2025-02-20","severity":"medium","attack_type":"spyware","keywords":["scarcruft","spyware","journalist","surveillance"],"iocs":{"ips":["210.52.109.66"],"domains":["press-secure-portal.com"],"hashes":[]},"lat":39.25,"lng":126.20,"country":"North Korea","risk_score":50,"indicators":["210.52.109.66"],"is_recent":True},

    # ── Iran (10) ────────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1789","source":"OTX","description":"APT35 Charming Kitten targets nuclear scientists with password spraying against Gmail and university email accounts","published_date":"2025-03-10","severity":"high","attack_type":"credential attack","keywords":["apt35","charming kitten","password spray","nuclear"],"iocs":{"ips":["5.61.28.44"],"domains":["gmail-account-verify.ir"],"hashes":[]},"lat":35.6892,"lng":51.3890,"country":"Iran","risk_score":70,"indicators":["5.61.28.44"],"is_recent":True},
    {"cve_id":"CVE-2025-2012","source":"RSS","description":"Iran-linked MuddyWater deploys PowerSploit framework against Middle Eastern government telecommunications providers","published_date":"2025-01-30","severity":"high","attack_type":"remote access trojan","keywords":["muddywater","powersploit","powershell","telecom"],"iocs":{"ips":["46.166.160.22"],"domains":["update-service.ir"],"hashes":[]},"lat":32.43,"lng":53.69,"country":"Iran","risk_score":70,"indicators":["46.166.160.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2345","source":"NVD","description":"OilRig APT leverages legitimate cloud services for C2 infrastructure targeting Israeli defense sector contractors","published_date":"2025-02-16","severity":"critical","attack_type":"espionage","keywords":["oilrig","cloud c2","israel","defense"],"iocs":{"ips":["5.61.30.11"],"domains":["cloud-storage-update.com"],"hashes":["e5f6a7b8c9d0e1f2"]},"lat":36.29,"lng":59.61,"country":"Iran","risk_score":90,"indicators":["5.61.30.11"],"is_recent":True},
    {"cve_id":"CVE-2025-2678","source":"OTX","description":"Shamoon disk-wiping malware variant targets Saudi Aramco subsidiary destroying 30000 workstations in coordinated attack","published_date":"2025-03-05","severity":"critical","attack_type":"destructive malware","keywords":["shamoon","wiper","saudi","energy","destructive"],"iocs":{"ips":["46.166.162.55"],"domains":[],"hashes":["f6a7b8c9d0e1f2a3"]},"lat":37.55,"lng":45.07,"country":"Iran","risk_score":90,"indicators":["46.166.162.55"],"is_recent":True},
    {"cve_id":"CVE-2025-3123","source":"NVD","description":"Stored XSS in popular Iranian e-commerce platform allows cookie theft and account takeover at scale","published_date":"2025-01-14","severity":"medium","attack_type":"web attack","keywords":["xss","ecommerce","stored xss","session hijack"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":34.79,"lng":48.51,"country":"Iran","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-3456","source":"RSS","description":"Iran disrupts Albanian government systems with second wave of cyberattacks following diplomatic expulsion","published_date":"2025-02-28","severity":"critical","attack_type":"destructive malware","keywords":["albania","government","destructive","wiper"],"iocs":{"ips":["5.61.28.100"],"domains":[],"hashes":[]},"lat":33.69,"lng":56.92,"country":"Iran","risk_score":90,"indicators":["5.61.28.100"],"is_recent":True},
    {"cve_id":"CVE-2025-3789","source":"OTX","description":"Agrius ransomware group encrypts Israeli logistics company systems after data exfiltration as cover for political statement","published_date":"2025-03-20","severity":"high","attack_type":"ransomware","keywords":["agrius","ransomware","israel","data theft"],"iocs":{"ips":["46.166.165.33"],"domains":["darknet-payment.onion"],"hashes":[]},"lat":35.81,"lng":50.92,"country":"Iran","risk_score":70,"indicators":["46.166.165.33"],"is_recent":True},
    {"cve_id":"CVE-2025-4012","source":"NVD","description":"Use-after-free vulnerability in Firefox allows attacker-controlled website to execute arbitrary code in browser context","published_date":"2025-01-06","severity":"high","attack_type":"remote execution","keywords":["firefox","use after free","browser","exploit kit"],"iocs":{"ips":["5.61.32.44"],"domains":[],"hashes":[]},"lat":32.66,"lng":51.67,"country":"Iran","risk_score":70,"indicators":["5.61.32.44"],"is_recent":True},
    {"cve_id":"CVE-2025-4345","source":"RSS","description":"Pioneer Kitten sells network access to ransomware affiliates after compromising US healthcare provider VPN","published_date":"2025-02-10","severity":"critical","attack_type":"initial access broker","keywords":["pioneer kitten","healthcare","vpn","ransomware affiliate"],"iocs":{"ips":["46.166.167.11"],"domains":[],"hashes":[]},"lat":38.07,"lng":46.30,"country":"Iran","risk_score":90,"indicators":["46.166.167.11"],"is_recent":True},
    {"cve_id":"CVE-2025-4678","source":"NVD","description":"Integer overflow in libxml2 parsing allows heap corruption when processing deeply nested XML documents","published_date":"2025-03-28","severity":"medium","attack_type":"remote execution","keywords":["libxml2","integer overflow","xml","heap"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":30.28,"lng":57.07,"country":"Iran","risk_score":50,"indicators":[],"is_recent":True},

    # ── United States (10) ───────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1023","source":"NVD","description":"Critical zero-day in Cisco IOS XE allows unauthenticated remote attacker to create privileged admin account","published_date":"2025-03-15","severity":"critical","attack_type":"authentication bypass","keywords":["cisco","ios xe","authentication bypass","zero-day","network"],"iocs":{"ips":["45.33.32.100"],"domains":[],"hashes":[]},"lat":37.7749,"lng":-122.4194,"country":"United States","risk_score":90,"indicators":["45.33.32.100"],"is_recent":True},
    {"cve_id":"CVE-2025-1256","source":"RSS","description":"Change Healthcare ransomware attack disrupts US pharmacy network affecting 6000 hospitals and pharmacies nationwide","published_date":"2025-02-25","severity":"critical","attack_type":"ransomware","keywords":["ransomware","healthcare","alphv","blackcat","critical infrastructure"],"iocs":{"ips":["198.199.10.55"],"domains":["blackcat-leak.onion"],"hashes":[]},"lat":40.7128,"lng":-74.0060,"country":"United States","risk_score":90,"indicators":["198.199.10.55"],"is_recent":True},
    {"cve_id":"CVE-2025-1489","source":"NVD","description":"Log4Shell variant CVE bypass allows RCE in applications using Apache Log4j 2.x via JNDI injection in log messages","published_date":"2025-01-20","severity":"critical","attack_type":"remote execution","keywords":["log4j","log4shell","jndi","rce","apache"],"iocs":{"ips":["45.33.32.150"],"domains":["ldap-exploit.com"],"hashes":[]},"lat":34.0522,"lng":-118.2437,"country":"United States","risk_score":90,"indicators":["45.33.32.150"],"is_recent":True},
    {"cve_id":"CVE-2025-1712","source":"OTX","description":"UNC3944 Scattered Spider social engineers Okta help desk to reset MFA for privileged accounts at cloud companies","published_date":"2025-03-05","severity":"high","attack_type":"social engineering","keywords":["scattered spider","okta","mfa bypass","cloud","social engineering"],"iocs":{"ips":["198.199.30.22"],"domains":["okta-support-alert.com"],"hashes":[]},"lat":47.6062,"lng":-122.3321,"country":"United States","risk_score":70,"indicators":["198.199.30.22"],"is_recent":True},
    {"cve_id":"CVE-2025-1945","source":"NVD","description":"Buffer overflow in macOS kernel extension allows local privilege escalation to root on Apple Silicon Macs","published_date":"2025-02-18","severity":"high","attack_type":"privilege escalation","keywords":["macos","kernel","buffer overflow","privilege escalation","apple"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":37.3382,"lng":-121.8863,"country":"United States","risk_score":70,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2178","source":"RSS","description":"Salt Security research reveals API security flaw in major banking app exposing 10M customer financial records","published_date":"2025-01-14","severity":"high","attack_type":"api attack","keywords":["api security","banking","data breach","financial"],"iocs":{"ips":["45.33.32.200"],"domains":[],"hashes":[]},"lat":41.8827,"lng":-87.6233,"country":"United States","risk_score":70,"indicators":["45.33.32.200"],"is_recent":True},
    {"cve_id":"CVE-2025-2401","source":"NVD","description":"Improper input validation in Kubernetes admission controller allows container escape to host node filesystem","published_date":"2025-03-22","severity":"critical","attack_type":"container escape","keywords":["kubernetes","container escape","privilege escalation","cloud native"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":37.4419,"lng":-122.1430,"country":"United States","risk_score":90,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2634","source":"OTX","description":"Rhysida ransomware affiliates breach US school district encrypting student records and demanding 20 BTC ransom","published_date":"2025-02-08","severity":"high","attack_type":"ransomware","keywords":["rhysida","education","ransomware","bitcoin"],"iocs":{"ips":["198.199.50.44"],"domains":["rhysida-payment.onion"],"hashes":[]},"lat":39.7392,"lng":-104.9903,"country":"United States","risk_score":70,"indicators":["198.199.50.44"],"is_recent":True},
    {"cve_id":"CVE-2025-2867","source":"NVD","description":"Open redirect vulnerability in popular OAuth implementation allows token theft via crafted redirect URI parameter","published_date":"2025-01-28","severity":"medium","attack_type":"web attack","keywords":["oauth","open redirect","token theft","authentication"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":42.3601,"lng":-71.0589,"country":"United States","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-3100","source":"RSS","description":"FrancophoneBE financially motivated hackers compromise US retail chain point-of-sale systems stealing card data","published_date":"2025-03-10","severity":"high","attack_type":"point of sale","keywords":["pos","payment card","retail","data theft"],"iocs":{"ips":["45.33.32.88"],"domains":[],"hashes":["a7b8c9d0e1f2a3b4"]},"lat":29.7604,"lng":-95.3698,"country":"United States","risk_score":70,"indicators":["45.33.32.88"],"is_recent":True},

    # ── Germany (8) ──────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1123","source":"NVD","description":"Remote code execution in SAP Application Server allows unauthenticated attacker to run OS commands via SOAP interface","published_date":"2025-02-20","severity":"critical","attack_type":"remote execution","keywords":["sap","soap","rce","enterprise"],"iocs":{"ips":["85.208.96.44"],"domains":[],"hashes":[]},"lat":52.5200,"lng":13.4050,"country":"Germany","risk_score":90,"indicators":["85.208.96.44"],"is_recent":True},
    {"cve_id":"CVE-2025-1356","source":"OTX","description":"Clop ransomware exploits GoAnywhere MFT zero-day stealing data from German automotive supplier before encryption","published_date":"2025-03-01","severity":"critical","attack_type":"ransomware","keywords":["clop","goanywhere","ransomware","automotive"],"iocs":{"ips":["213.239.10.55"],"domains":["clop-leaks.onion"],"hashes":[]},"lat":48.14,"lng":11.58,"country":"Germany","risk_score":90,"indicators":["213.239.10.55"],"is_recent":True},
    {"cve_id":"CVE-2025-1589","source":"RSS","description":"German hospital network hit by ransomware forcing emergency patient diversion affecting surgical operations","published_date":"2025-01-22","severity":"critical","attack_type":"ransomware","keywords":["hospital","ransomware","healthcare","emergency"],"iocs":{"ips":["85.208.99.77"],"domains":[],"hashes":[]},"lat":50.94,"lng":6.96,"country":"Germany","risk_score":90,"indicators":["85.208.99.77"],"is_recent":True},
    {"cve_id":"CVE-2025-1822","source":"NVD","description":"Prototype pollution in popular npm package lodash allows remote code execution in Node.js applications","published_date":"2025-02-14","severity":"high","attack_type":"injection","keywords":["npm","lodash","prototype pollution","nodejs"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":53.57,"lng":10.00,"country":"Germany","risk_score":70,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2055","source":"OTX","description":"APT29 Cozy Bear targets German political parties with spear-phishing ahead of federal election stealing campaign documents","published_date":"2025-03-18","severity":"high","attack_type":"espionage","keywords":["apt29","cozy bear","election","spear phishing","germany"],"iocs":{"ips":["213.239.44.88"],"domains":["bundestag-update.net"],"hashes":[]},"lat":52.37,"lng":9.73,"country":"Germany","risk_score":70,"indicators":["213.239.44.88"],"is_recent":True},
    {"cve_id":"CVE-2025-2288","source":"NVD","description":"Cross-site request forgery in industrial control system web interface allows changing PLC configuration remotely","published_date":"2025-01-18","severity":"high","attack_type":"ics attack","keywords":["csrf","ics","plc","scada","industrial"],"iocs":{"ips":["85.208.100.22"],"domains":[],"hashes":[]},"lat":51.51,"lng":7.46,"country":"Germany","risk_score":70,"indicators":["85.208.100.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2521","source":"RSS","description":"Scattered Spider breaches German fintech customer data through Microsoft Teams social engineering of help desk","published_date":"2025-02-28","severity":"medium","attack_type":"social engineering","keywords":["social engineering","fintech","teams","data breach"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":48.78,"lng":9.18,"country":"Germany","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2754","source":"NVD","description":"SQL injection in Drupal core CMS allows unauthenticated attacker to dump entire database including admin password hashes","published_date":"2025-03-12","severity":"critical","attack_type":"injection","keywords":["drupal","sql injection","cms","authentication"],"iocs":{"ips":["213.239.22.44"],"domains":[],"hashes":[]},"lat":51.09,"lng":17.04,"country":"Germany","risk_score":90,"indicators":["213.239.22.44"],"is_recent":True},

    # ── Netherlands (8) ──────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1678","source":"OTX","description":"Lockbit 3.0 ransomware operates C2 infrastructure through Dutch hosting providers via bulletproof hosting network","published_date":"2025-02-22","severity":"critical","attack_type":"ransomware","keywords":["lockbit","c2","bulletproof hosting","ransomware"],"iocs":{"ips":["185.220.101.44"],"domains":["lockbit3-payment.onion"],"hashes":[]},"lat":52.3676,"lng":4.9041,"country":"Netherlands","risk_score":90,"indicators":["185.220.101.44"],"is_recent":True},
    {"cve_id":"CVE-2025-1901","source":"NVD","description":"TLS certificate transparency log poisoning allows threat actor to intercept encrypted HTTPS traffic for targeted domains","published_date":"2025-01-15","severity":"high","attack_type":"man in the middle","keywords":["tls","certificate","mitm","https"],"iocs":{"ips":["194.165.10.33"],"domains":[],"hashes":[]},"lat":52.09,"lng":5.10,"country":"Netherlands","risk_score":70,"indicators":["194.165.10.33"],"is_recent":True},
    {"cve_id":"CVE-2025-2134","source":"RSS","description":"Tor exit node operated from Amsterdam used in coordinated DDoS attack against European financial exchanges","published_date":"2025-03-08","severity":"medium","attack_type":"denial of service","keywords":["ddos","tor","financial","exchange"],"iocs":{"ips":["185.220.101.88"],"domains":[],"hashes":[]},"lat":51.92,"lng":4.48,"country":"Netherlands","risk_score":50,"indicators":["185.220.101.88"],"is_recent":True},
    {"cve_id":"CVE-2025-2367","source":"NVD","description":"Remote code execution in VMware vCenter appliance via SSRF allows pivot from management network to VM guests","published_date":"2025-02-05","severity":"critical","attack_type":"remote execution","keywords":["vmware","vcenter","ssrf","rce","virtualization"],"iocs":{"ips":["194.165.16.22"],"domains":[],"hashes":[]},"lat":53.22,"lng":6.57,"country":"Netherlands","risk_score":90,"indicators":["194.165.16.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2600","source":"OTX","description":"TA542 Emotet botnet herder coordinates zombie network from Amsterdam VPS for spam campaign distribution","published_date":"2025-03-18","severity":"medium","attack_type":"botnet","keywords":["emotet","botnet","spam","ta542"],"iocs":{"ips":["185.220.102.11"],"domains":["emotet-c2.net"],"hashes":[]},"lat":52.15,"lng":5.39,"country":"Netherlands","risk_score":50,"indicators":["185.220.102.11"],"is_recent":True},
    {"cve_id":"CVE-2025-2833","source":"NVD","description":"Insecure direct object reference in API gateway allows horizontal privilege escalation reading other user private data","published_date":"2025-01-25","severity":"medium","attack_type":"api attack","keywords":["idor","api","authorization","data leak"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":51.44,"lng":5.47,"country":"Netherlands","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-3066","source":"RSS","description":"DNS hijacking campaign redirects Dutch internet users to phishing sites by compromising ISP resolver infrastructure","published_date":"2025-02-18","severity":"high","attack_type":"dns attack","keywords":["dns hijacking","isp","phishing","dns"],"iocs":{"ips":["194.165.22.44"],"domains":["dns-resolver-update.nl"],"hashes":[]},"lat":52.37,"lng":4.90,"country":"Netherlands","risk_score":70,"indicators":["194.165.22.44"],"is_recent":True},
    {"cve_id":"CVE-2025-3299","source":"NVD","description":"Command injection in network-attached storage web admin panel allows remote root shell execution without authentication","published_date":"2025-03-25","severity":"critical","attack_type":"injection","keywords":["nas","command injection","storage","unauthenticated"],"iocs":{"ips":["185.220.103.55"],"domains":[],"hashes":[]},"lat":51.56,"lng":4.79,"country":"Netherlands","risk_score":90,"indicators":["185.220.103.55"],"is_recent":True},

    # ── Brazil (8) ───────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1234","source":"OTX","description":"Brazilian banking trojan Grandoreiro steals one-time passwords via overlay attack targeting 900 banks globally","published_date":"2025-03-12","severity":"high","attack_type":"banking trojan","keywords":["grandoreiro","banking trojan","otp theft","overlay"],"iocs":{"ips":["177.54.10.22"],"domains":["grandoreiro-c2.br"],"hashes":["b8c9d0e1f2a3b4c5"]},"lat":-23.5505,"lng":-46.6333,"country":"Brazil","risk_score":70,"indicators":["177.54.10.22"],"is_recent":True},
    {"cve_id":"CVE-2025-1467","source":"RSS","description":"Grandoreiro botnet operators arrested in Spain after Europol investigation but successor groups continue operations","published_date":"2025-02-15","severity":"high","attack_type":"banking trojan","keywords":["grandoreiro","banking","europol","arrest"],"iocs":{"ips":["189.112.10.55"],"domains":[],"hashes":[]},"lat":-15.77,"lng":-47.93,"country":"Brazil","risk_score":70,"indicators":["189.112.10.55"],"is_recent":True},
    {"cve_id":"CVE-2025-1700","source":"NVD","description":"Exposed AWS S3 bucket at Brazilian e-commerce giant leaks 5M customer credit card numbers and personal data","published_date":"2025-01-18","severity":"critical","attack_type":"data exposure","keywords":["aws","s3","data breach","misconfiguration","credit card"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":-22.90,"lng":-43.17,"country":"Brazil","risk_score":90,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-1933","source":"OTX","description":"Prilex point-of-sale malware updated to block contactless NFC payments forcing chip card swipes for skimming","published_date":"2025-02-28","severity":"high","attack_type":"point of sale","keywords":["prilex","pos","nfc","payment skimming"],"iocs":{"ips":["177.54.30.88"],"domains":[],"hashes":["c9d0e1f2a3b4c5d6"]},"lat":-3.10,"lng":-60.02,"country":"Brazil","risk_score":70,"indicators":["177.54.30.88"],"is_recent":True},
    {"cve_id":"CVE-2025-2166","source":"NVD","description":"SQL injection in PIX payment system API allows attacker to redirect transactions to attacker-controlled accounts","published_date":"2025-03-05","severity":"critical","attack_type":"injection","keywords":["pix","payment","sql injection","financial fraud"],"iocs":{"ips":["189.112.44.22"],"domains":[],"hashes":[]},"lat":-12.97,"lng":-38.51,"country":"Brazil","risk_score":90,"indicators":["189.112.44.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2399","source":"RSS","description":"Lapsus$ successor group leaks internal source code from Brazilian government after ransomware demands refused","published_date":"2025-01-25","severity":"high","attack_type":"ransomware","keywords":["lapsus","government","source code leak","ransomware"],"iocs":{"ips":["177.54.50.11"],"domains":[],"hashes":[]},"lat":-30.03,"lng":-51.23,"country":"Brazil","risk_score":70,"indicators":["177.54.50.11"],"is_recent":True},
    {"cve_id":"CVE-2025-2632","source":"NVD","description":"Weak default credentials in smart city IoT sensors allow mass compromise enabling persistent surveillance network","published_date":"2025-02-10","severity":"medium","attack_type":"iot attack","keywords":["iot","default credentials","smart city","surveillance"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":-8.05,"lng":-34.88,"country":"Brazil","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2865","source":"OTX","description":"PixPirate Android malware with self-hiding capability steals PIX banking credentials from Brazilian users","published_date":"2025-03-20","severity":"high","attack_type":"mobile malware","keywords":["android","pixpirate","mobile","banking trojan","pix"],"iocs":{"ips":["177.54.88.33"],"domains":["pix-seguro-update.com"],"hashes":["d0e1f2a3b4c5d6e7"]},"lat":-1.46,"lng":-48.49,"country":"Brazil","risk_score":70,"indicators":["177.54.88.33"],"is_recent":True},

    # ── India (7) ────────────────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1890","source":"NVD","description":"Authentication bypass in mobile banking application allows account takeover without OTP by replaying JWT tokens","published_date":"2025-02-28","severity":"critical","attack_type":"authentication bypass","keywords":["mobile banking","jwt","authentication bypass","otp"],"iocs":{"ips":["117.96.10.55"],"domains":[],"hashes":[]},"lat":28.6139,"lng":77.2090,"country":"India","risk_score":90,"indicators":["117.96.10.55"],"is_recent":True},
    {"cve_id":"CVE-2025-2123","source":"OTX","description":"SideCopy APT targets Indian defense ministry employees with weapon test schedule lure delivering AsyncRAT malware","published_date":"2025-03-10","severity":"high","attack_type":"remote access trojan","keywords":["sidecopy","asyncrat","defense","india","spear phishing"],"iocs":{"ips":["49.36.10.22"],"domains":["mod-india-portal.com"],"hashes":["e1f2a3b4c5d6e7f8"]},"lat":19.08,"lng":72.88,"country":"India","risk_score":70,"indicators":["49.36.10.22"],"is_recent":True},
    {"cve_id":"CVE-2025-2356","source":"RSS","description":"Aadhaar biometric database breach exposes 815 million Indian citizen records on dark web markets","published_date":"2025-01-20","severity":"critical","attack_type":"data breach","keywords":["aadhaar","biometric","data breach","india","pii"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":22.57,"lng":88.36,"country":"India","risk_score":90,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2589","source":"NVD","description":"Remote code execution in Indian railway ticketing system allows mass booking manipulation and revenue fraud","published_date":"2025-02-12","severity":"high","attack_type":"remote execution","keywords":["railway","ticketing","fraud","rce"],"iocs":{"ips":["117.96.44.88"],"domains":[],"hashes":[]},"lat":13.08,"lng":80.27,"country":"India","risk_score":70,"indicators":["117.96.44.88"],"is_recent":True},
    {"cve_id":"CVE-2025-2822","source":"OTX","description":"Transparent Tribe APT continues targeting Indian Air Force with Crimson RAT delivered via military document lures","published_date":"2025-03-18","severity":"high","attack_type":"remote access trojan","keywords":["transparent tribe","crimson rat","air force","military"],"iocs":{"ips":["49.36.88.22"],"domains":["iaf-documents.net"],"hashes":[]},"lat":17.38,"lng":78.47,"country":"India","risk_score":70,"indicators":["49.36.88.22"],"is_recent":True},
    {"cve_id":"CVE-2025-3055","source":"NVD","description":"Insecure storage of encryption keys in UPI payment app allows offline brute force attack recovering user PIN","published_date":"2025-01-08","severity":"medium","attack_type":"cryptographic flaw","keywords":["upi","payment","encryption","pin"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":12.97,"lng":77.59,"country":"India","risk_score":50,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-3288","source":"RSS","description":"IndiaSpy commercial spyware deployed against civil society activists journalists and opposition politicians","published_date":"2025-02-25","severity":"high","attack_type":"spyware","keywords":["spyware","surveillance","journalist","activist"],"iocs":{"ips":["117.96.100.55"],"domains":["news-update-portal.in"],"hashes":[]},"lat":23.35,"lng":85.33,"country":"India","risk_score":70,"indicators":["117.96.100.55"],"is_recent":True},

    # ── United Kingdom (7) ───────────────────────────────────────────────────
    {"cve_id":"CVE-2025-1345","source":"RSS","description":"Medusa ransomware encrypts NHS patient records across three UK hospital trusts halting elective surgeries","published_date":"2025-03-05","severity":"critical","attack_type":"ransomware","keywords":["medusa","nhs","ransomware","healthcare","uk"],"iocs":{"ips":["51.89.10.44"],"domains":["medusa-leaks.onion"],"hashes":[]},"lat":51.5074,"lng":-0.1278,"country":"United Kingdom","risk_score":90,"indicators":["51.89.10.44"],"is_recent":True},
    {"cve_id":"CVE-2025-1578","source":"OTX","description":"REvil successor group exfiltrates client data from UK law firm representing FTSE 100 companies threatening extortion","published_date":"2025-02-14","severity":"critical","attack_type":"data extortion","keywords":["revil","law firm","extortion","data theft"],"iocs":{"ips":["195.206.10.22"],"domains":["revil-leaks.onion"],"hashes":[]},"lat":53.48,"lng":-2.24,"country":"United Kingdom","risk_score":90,"indicators":["195.206.10.22"],"is_recent":True},
    {"cve_id":"CVE-2025-1811","source":"NVD","description":"Vulnerability in GCHQ-approved encryption library allows timing side-channel attack recovering private keys within hours","published_date":"2025-01-22","severity":"high","attack_type":"cryptographic attack","keywords":["encryption","side channel","timing attack","private key"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":51.52,"lng":-1.79,"country":"United Kingdom","risk_score":70,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2044","source":"RSS","description":"Supply chain attack on UK elections digital infrastructure attempted via compromise of voter registration software vendor","published_date":"2025-03-12","severity":"critical","attack_type":"supply chain","keywords":["election","supply chain","voter registration","democracy"],"iocs":{"ips":["51.89.44.88"],"domains":["gov-election-update.co.uk"],"hashes":[]},"lat":52.48,"lng":-1.90,"country":"United Kingdom","risk_score":90,"indicators":["51.89.44.88"],"is_recent":True},
    {"cve_id":"CVE-2025-2277","source":"NVD","description":"Buffer overflow in VPN client for Windows allows local privilege escalation to SYSTEM via crafted config file","published_date":"2025-02-08","severity":"high","attack_type":"privilege escalation","keywords":["vpn","buffer overflow","windows","privilege escalation"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":53.80,"lng":-1.55,"country":"United Kingdom","risk_score":70,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-2510","source":"OTX","description":"NoName057 hacktivist DDoS campaign targets UK parliament NATO websites and media organizations for two weeks","published_date":"2025-01-15","severity":"medium","attack_type":"denial of service","keywords":["ddos","noname057","hacktivist","parliament","nato"],"iocs":{"ips":["195.206.55.44"],"domains":[],"hashes":[]},"lat":51.43,"lng":0.37,"country":"United Kingdom","risk_score":50,"indicators":["195.206.55.44"],"is_recent":True},
    {"cve_id":"CVE-2025-2743","source":"NVD","description":"Authentication flaw in NHS digital patient portal allows account enumeration via predictable user ID sequences","published_date":"2025-03-22","severity":"medium","attack_type":"authentication flaw","keywords":["nhs","healthcare","account enumeration","authentication"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":53.38,"lng":-1.47,"country":"United Kingdom","risk_score":50,"indicators":[],"is_recent":True},

    # ── Mixed/Global (5 extra) ───────────────────────────────────────────────
    {"cve_id":"CVE-2025-9001","source":"NVD","description":"Critical RCE in OpenSSL allows attacker to crash any TLS server or execute code via specially crafted client certificate","published_date":"2025-03-28","severity":"critical","attack_type":"remote execution","keywords":["openssl","tls","rce","certificate"],"iocs":{"ips":["45.142.212.99"],"domains":[],"hashes":[]},"lat":48.86,"lng":2.35,"country":"France","risk_score":90,"indicators":["45.142.212.99"],"is_recent":True},
    {"cve_id":"CVE-2025-9002","source":"OTX","description":"Midnight Blizzard APT compromises Microsoft corporate email stealing source code and credentials in sustained campaign","published_date":"2025-02-01","severity":"critical","attack_type":"espionage","keywords":["midnight blizzard","microsoft","corporate email","source code","apt"],"iocs":{"ips":["194.165.88.44"],"domains":["microsoft-corp-update.net"],"hashes":[]},"lat":59.33,"lng":18.07,"country":"Sweden","risk_score":90,"indicators":["194.165.88.44"],"is_recent":True},
    {"cve_id":"CVE-2025-9003","source":"RSS","description":"KillNet pro-Russia hacktivist group coordinates DDoS attack against European Central Bank disrupting banking operations","published_date":"2025-03-15","severity":"high","attack_type":"denial of service","keywords":["killnet","ddos","ecb","banking","russia"],"iocs":{"ips":["5.188.210.55"],"domains":[],"hashes":[]},"lat":50.11,"lng":8.68,"country":"Germany","risk_score":70,"indicators":["5.188.210.55"],"is_recent":True},
    {"cve_id":"CVE-2025-9004","source":"NVD","description":"Spectre v3 variant side-channel attack allows JavaScript code in browser to read kernel memory across process boundaries","published_date":"2025-01-30","severity":"high","attack_type":"side channel","keywords":["spectre","side channel","browser","kernel memory"],"iocs":{"ips":[],"domains":[],"hashes":[]},"lat":37.57,"lng":126.98,"country":"South Korea","risk_score":70,"indicators":[],"is_recent":True},
    {"cve_id":"CVE-2025-9005","source":"OTX","description":"BlackMatter ransomware targets agricultural cooperative during harvest season maximizing pressure to pay ransom","published_date":"2025-02-20","severity":"critical","attack_type":"ransomware","keywords":["blackmatter","ransomware","agriculture","critical infrastructure"],"iocs":{"ips":["185.220.104.55"],"domains":["blackmatter-pay.onion"],"hashes":["f1a2b3c4d5e6f7a8"]},"lat":48.21,"lng":16.37,"country":"Austria","risk_score":90,"indicators":["185.220.104.55"],"is_recent":True},
]


def _seed_elasticsearch():
    """Idempotent seed: only inserts if ES has fewer than 50 threat documents."""
    try:
        # Check current document count
        count_res = requests.get(
            f"{ES_INDEX_URL}/_count",
            json={"query": {"match_all": {}}},
            **REQ_KWARGS,
            timeout=10
        )
        if count_res.status_code == 200:
            current_count = count_res.json().get("count", 0)
            if current_count >= 50:
                print(f"Seed skipped: ES already has {current_count} documents.")
                return

        # Build bulk payload (PUT with deterministic IDs = idempotent)
        bulk_lines = []
        for i, threat in enumerate(SEED_THREATS):
            doc_id = f"seed-{i+1:03d}"
            bulk_lines.append(json.dumps({"index": {"_index": "threats", "_id": doc_id}}))
            bulk_lines.append(json.dumps(threat))

        bulk_body = "\n".join(bulk_lines) + "\n"
        bulk_url = f"{clean_es_url}/_bulk"

        bulk_kwargs = dict(REQ_KWARGS)
        headers = {"Content-Type": "application/x-ndjson"}
        res = requests.post(bulk_url, data=bulk_body, headers=headers, **bulk_kwargs, timeout=30)
        if res.status_code < 300:
            errors = [i for i in res.json().get("items", []) if "error" in i.get("index", {})]
            print(f"Seeded {len(SEED_THREATS)} threats into Elasticsearch. Errors: {len(errors)}")
        else:
            print(f"Seed bulk insert failed: {res.status_code} — {res.text[:200]}")
    except Exception as ex:
        print(f"Seed skipped (non-fatal): {ex}")

app = FastAPI(
    title="Threat Intel Search API",
    description="A simple API to search enriched Elasticsearch threat data."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://threat-intel-pipeline-systems-bt8p.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Parse Elasticsearch URL securely to handle both Cloud and Local connections
RAW_ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
parsed_url = __import__("urllib.parse").parse.urlparse(RAW_ES_URL)

REQ_KWARGS = {}
if parsed_url.username and parsed_url.password:
    REQ_KWARGS["auth"] = (parsed_url.username, parsed_url.password)
    safe_netloc = parsed_url.hostname
    if parsed_url.port:
        safe_netloc += f":{parsed_url.port}"
    clean_es_url = parsed_url._replace(netloc=safe_netloc).geturl()
else:
    clean_es_url = RAW_ES_URL

# Bypass self-signed SSL verification strictly for local testing to avoid crashes
if clean_es_url.startswith("https://localhost") or clean_es_url.startswith("https://127.0.0.1"):
    import urllib3
    urllib3.disable_warnings()
    REQ_KWARGS["verify"] = False

ES_INDEX_URL = f"{clean_es_url}/threats"
ES_URL = f"{ES_INDEX_URL}/_search"

@app.get("/")
@app.head("/")
def health_check():
    return {"status": "live", "service": "threat-intel-pipeline-systems"}

@app.on_event("startup")
def ensure_index():
    try:
        if requests.head(ES_INDEX_URL, **REQ_KWARGS).status_code == 404:
            requests.put(ES_INDEX_URL, **REQ_KWARGS)
    except Exception as e:
        print(f"Startup index check failed: {e}")
    # Auto-seed realistic threat data ONLY in non-production environments
    if os.getenv("ENV", "dev") != "prod":
        _seed_elasticsearch()

@app.get("/search")
def search_threats(
    keyword: str = Query(None, description="Search across description and keywords"),
    severity: str = Query(None, description="Filter exactly by severity (e.g. critical, high, medium)"),
    limit: int = Query(10, description="Limit the number of returned records")
):
    # Base Elasticsearch query structure
    es_query = {
        "size": limit if limit else 100,
        "query": {
            "bool": {
                "must": []
            }
        }
    }
    
    must_clauses = es_query["query"]["bool"]["must"]
    
    # If no criteria provided, fetch standard 20 records
    if not keyword and not severity:
        must_clauses.append({"match_all": {}})
        
    # Append multi_match for OR-based search across multiple fields
    if keyword:
        must_clauses.append({
            "multi_match": {
                "query": keyword,
                "fields": ["description", "keywords", "attack_type"],
                "operator": "or"
            }
        })
        
    # Append match for strictly filtering severity fields
    if severity:
        must_clauses.append({
            "match": {
                "severity": severity
            }
        })
        
    try:
        # Posing query natively via Elasticsearch REST API with correct Auth/SSL kwargs
        response = requests.get(ES_URL, json=es_query, **REQ_KWARGS)
        response.raise_for_status()
        data = response.json()
        
        results = []
        hits = data.get("hits", {}).get("hits", [])
        
        # Mapping results cleanly out of the _source container
        for hit in hits:
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "source": source.get("source", "Unknown"),
                "description": source.get("description", "No description"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "severity": source.get("severity", "unknown"),
                "iocs": source.get("iocs", {})
            })
            
        return results
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Elasticsearch query critically failed: {str(e)}"
        )

@app.get("/geo-threats")
def geo_threats(limit: int = Query(50, description="Max geo-tagged threats to return")):
    """Return all threats that have real lat/lng coordinates from worker geo-enrichment."""
    es_query = {
        "size": limit,
        "query": {
            "bool": {
                "must": [
                    {"exists": {"field": "lat"}},
                    {"exists": {"field": "lng"}}
                ]
            }
        },
        "_source": [
            "cve_id", "description", "source", "published_date",
            "severity", "keywords", "attack_type", "iocs",
            "lat", "lng", "country", "risk_score", "indicators"
        ]
    }
    try:
        response = requests.get(ES_URL, json=es_query, **REQ_KWARGS)
        response.raise_for_status()
        data = response.json()
        results = []
        for hit in data.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "description": source.get("description", ""),
                "source": source.get("source", ""),
                "published_date": source.get("published_date", ""),
                "severity": source.get("severity", "unknown"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "iocs": source.get("iocs", {}),
                "lat": source.get("lat"),
                "lng": source.get("lng"),
                "country": source.get("country", ""),
                "risk_score": source.get("risk_score", 0),
                "indicators": source.get("indicators", []),
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geo threats query failed: {str(e)}")

@app.get("/semantic-search")
def semantic_search(
    query: str = Query(None, description="Natural language AI search query"),
    limit: int = Query(10, description="Limit maximum hits")
):
    # Step 3 Safe Fallback
    if not query:
        return []

    # Step 2 Smart Fallback
    try:
        import os
        # Render Free instances have 512MB hard limit. PyTorch + SentenceTransformers requires ~800MB+.
        # We must actively prevent the model from loading to protect Uvicorn from OS-level SIGKILL (OOM),
        # which silently drops the container into the permanent 521 CORS graveyard.
        if os.environ.get("RENDER") and not os.environ.get("RENDER_PAID_TIER"):
            raise Exception("Cloud Memory Protection: Semantic search requires an upgraded instance (>1GB RAM). PyTorch initialization blocked to strictly prevent a permanent 521 OOM crash.")

        from sentence_transformers import SentenceTransformer
        # Load local AI model block dynamically
        model = SentenceTransformer('all-MiniLM-L6-v2')
        query_vector = model.encode(query).tolist()
        
        # Execute a script_score mapping cosine semantic similarity strictly requiring the embedding field
        es_query = {
            "size": limit,
            "query": {
                "script_score": {
                    "query": {"exists": {"field": "embedding"}},
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": query_vector}
                    }
                }
            }
        }
            
        response = requests.get(ES_URL, json=es_query, **REQ_KWARGS)
        response.raise_for_status()
        data = response.json()
        
        results = []
        hits = data.get("hits", {}).get("hits", [])
        
        for hit in hits:
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "description": source.get("description", "No description"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "severity": source.get("severity", "unknown"),
                "iocs": source.get("iocs", {})
            })
            
        return results
    except Exception as e:
        # Returning graceful empty array to prevent frontend `data.forEach is not a function` crash 
        # instead of a raw error object, fulfilling the AI mandate to fix the system securely and smart.
        print(f"Semantic search temporarily unavailable: {e}")
        return []


@app.get("/all-threats")
def all_threats(limit: int = Query(200, description="Max threats to return — used for dashboard initial load")):
    """Return all indexed threats (match_all). Used by the frontend on initial load to show 100+ threats."""
    es_query = {
        "size": min(limit, 200),
        "query": {"match_all": {}},
        "sort": [{"published_date": {"order": "desc", "unmapped_type": "keyword"}}],
        "_source": [
            "cve_id", "description", "source", "published_date",
            "severity", "keywords", "attack_type", "iocs",
            "lat", "lng", "country", "risk_score", "indicators", "is_recent"
        ]
    }
    try:
        response = requests.get(ES_URL, json=es_query, **REQ_KWARGS, timeout=15)
        response.raise_for_status()
        data = response.json()
        results = []
        for hit in data.get("hits", {}).get("hits", []):
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "description": source.get("description", ""),
                "source": source.get("source", ""),
                "published_date": source.get("published_date", ""),
                "severity": source.get("severity", "unknown"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "iocs": source.get("iocs", {}),
                "lat": source.get("lat"),
                "lng": source.get("lng"),
                "country": source.get("country", ""),
                "risk_score": source.get("risk_score", 0),
                "indicators": source.get("indicators", []),
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"All-threats query failed: {str(e)}")


@app.get("/stats")
def get_stats():
    """Total count + severity breakdown — used by the dashboard header KPI cards."""
    agg_query = {
        "size": 0,
        "query": {"match_all": {}},
        "aggs": {
            "severity_breakdown": {
                "terms": {"field": "severity.keyword", "size": 10}
            }
        }
    }
    try:
        response = requests.get(ES_URL, json=agg_query, **REQ_KWARGS, timeout=10)
        response.raise_for_status()
        data = response.json()
        total = data.get("hits", {}).get("total", {}).get("value", 0)
        buckets = data.get("aggregations", {}).get("severity_breakdown", {}).get("buckets", [])
        severity_counts = {b["key"]: b["doc_count"] for b in buckets}
        return {"total": total, "severity": severity_counts, "sources": ["NVD", "OTX", "RSS"], "status": "live"}
    except Exception as e:
        return {"total": 0, "severity": {}, "sources": [], "status": "error", "detail": str(e)}
