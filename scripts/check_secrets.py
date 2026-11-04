"""Inspect Git candidates, report archives and optionally history without printing secrets."""
from pathlib import Path
import io
import json
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [rb"AIza[0-9A-Za-z_-]{30,}", rb"gh[pousr]_[0-9A-Za-z]{30,}", rb"github_pat_[0-9A-Za-z_]{40,}", rb"sk-proj-[0-9A-Za-z_-]{30,}", rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"]
known = []
for env in [ROOT/".env", ROOT.parent/".env.proxy"]:
    if env.is_file():
        for line in env.read_text().splitlines():
            key,sep,value = line.partition("=")
            if sep and re.search(r"(?:TOKEN|KEY|PASSWORD|SECRET)$",key.strip()):
                value=value.strip().strip("\"'")
                if len(value)>=12:
                    known.append(value.encode())
hits = set()


def inspect(label, content):
    if any(re.search(p,content) for p in PATTERNS) or any(v in content for v in known):
        hits.add(label)
    if content.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            for name in z.namelist():
                if not name.endswith("/"):
                    inspect(label+"!"+name,z.read(name))


names=subprocess.check_output(["git","ls-files","--cached","--others","--exclude-standard","-z"],cwd=ROOT).split(b"\0")
count=0
for name in filter(None,names):
    relative=name.decode()
    path=ROOT/relative
    if path.is_file():
        if path.name.startswith(".env") and path.name!=".env.example":
            hits.add(relative)
        inspect(relative,path.read_bytes())
        count+=1
history=0
if "--history" in sys.argv:
    for line in subprocess.check_output(["git","rev-list","--objects","--all"],cwd=ROOT).splitlines():
        oid,_,name=line.partition(b" ")
        if subprocess.check_output(["git","cat-file","-t",oid],cwd=ROOT).strip()!=b"blob":
            continue
        inspect("history:"+name.decode(errors="replace"),subprocess.check_output(["git","cat-file","blob",oid],cwd=ROOT))
        history+=1
print(json.dumps({"files":count,"historyBlobs":history,"findings":sorted(hits)},ensure_ascii=False))
raise SystemExit(bool(hits))
