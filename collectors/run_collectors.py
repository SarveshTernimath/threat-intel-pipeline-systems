import subprocess

if __name__ == "__main__":
    print("Starting continuous collectors...")
    cmds = [
        ["python", "collectors/otx_collector.py"],
        ["python", "collectors/rss_collector.py"],
        ["python", "collectors/nvd_collector.py"],
        ["python", "collectors/ioc_collector.py"],
        ["python", "collectors/ip_blocklist_collector.py"],
    ]
    procs = [subprocess.Popen(cmd) for cmd in cmds]

    try:
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        for p in procs:
            p.terminate()
