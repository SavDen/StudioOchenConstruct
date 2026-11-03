from pathlib import Path
import sys,json,termios
r=Path(__file__).resolve().parents[1]
a=termios.tcgetattr(0);a[3]&=~(termios.ECHO|termios.ICANON);termios.tcsetattr(0,0,a)
print("Ready for files.",flush=True)
b={}
for l in sys.stdin:
 p=json.loads(l)
 for n,c in p.get("files",{}).items():
  f=(r/n).resolve()
  assert f.is_relative_to(r)
  b[n]=(b.get(n,"") if p.get("append") else "")+c
 if p.get("done",True):
  for n,c in b.items():
   f=r/n;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(c,encoding="utf-8")
  print("Saved "+str(len(b))+" files.",flush=True);break
 print("Buffered.",flush=True)
