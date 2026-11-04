"""Import the supplied standalone SVGs at their exact authored dimensions.

Only semantic color attributes and accessibility metadata are added. No paths,
transforms, viewBoxes or dimensions are rewritten. Re-run with a source folder
argument; without one, use the archived source folder bundled with the project.
"""
from pathlib import Path
import hashlib
import json
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT.parent / "illustration-library"
if not LIB.exists():
    LIB = ROOT / "library"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else LIB / "sources" / "canonical"
ARCHIVE = LIB / "sources" / "canonical"
ARCHIVE.mkdir(parents=True, exist_ok=True)
ET.register_namespace("", "http://www.w3.org/2000/svg")

# Each tuple is L colored, L monochrome, S colored, S monochrome.
FILES = {
    "book": ("Книга", "Книга-1", "Group 2136136335", "Group 2136136341"),
    "phone": ("Телефон", "Телефон-1", "Телефон-2", "Телефон-3"),
    "puzzle": ("Пазлы", "Пазлы-1", "Пазлы-2", "Пазлы-3"),
    "coin": ("Монета", "Монета-1", "Монета-2", "Монета-3"),
    "headphones": ("Наушники", "Наушники-1", "Наушники-2", "Наушники-3"),
    "lamp": ("Лампа", "Лампа-1", "Лампа-2", "Лампа-3"),
    "flowers": ("Group 2136136344", "Group 2136136347", "Group 2136136345", "Group 2136136346"),
    "wallet": ("Кошелек", "Кошелек-1", "Кошелек-2", "Кошелек-3"),
    "folder": ("Папка", "Папка-1", "Group 2136136337", "Group 2136136342"),
    "pen": ("Ручка", "Ручка-1", "Group 2136136336", "Group 2136136343"),
}
palettes = json.loads((LIB / "palettes.json").read_text())
slots = palettes["palettes"][0]["slots"]
color_slots = {value.upper(): key for key, value in slots.items()}
color_slots["WHITE"] = "paper"
manifest = json.loads((LIB / "manifest.json").read_text())
checksums = {}
for asset in manifest["assets"]:
    for (size, role), stem in zip(
        [("L", "main"), ("L", "background"), ("S", "main"), ("S", "background")], FILES[asset["id"]]
    ):
        name = stem + ".svg"
        source = SOURCE / name
        raw = source.read_bytes()
        if source.resolve() != (ARCHIVE / name).resolve():
            shutil.copy2(source, ARCHIVE / name)
        checksums[name] = hashlib.sha256(raw).hexdigest()
        svg = ET.fromstring(raw)
        width, height = float(svg.attrib["width"]), float(svg.attrib["height"])
        used = set()
        for node in svg.iter():
            for attr in ["fill", "stroke"]:
                value = node.get(attr)
                if not value or value == "none":
                    continue
                slot = color_slots.get(value.upper())
                if not slot:
                    raise ValueError(f"Unknown color {value} in {name}")
                if role == "background" and slot.startswith("object."):
                    raise ValueError(f"Foreground color in background {name}")
                node.set("data-" + attr + "-slot", slot)
                used.add(slot)
        svg.set("data-asset-id", asset["id"] + "-" + size + "-" + role)
        svg.set("role", "img")
        svg.set("aria-label", asset["name"])
        target = f"assets/{size}/{role}/{asset['id']}.svg"
        encoded = ET.tostring(svg, encoding="unicode")
        (LIB / target).write_text(encoded + "\n")
        asset["variants"][size][role] = {
            "path": target, "nativeWidth": width, "nativeHeight": height,
            "artworkWidth": width, "artworkHeight": height, "padding": 0,
            "pathCount": sum(n.tag.endswith("}path") for n in svg.iter()),
            "colorSlots": sorted(used), "sourceFile": "sources/canonical/" + name,
            "sourceSha256": checksums[name], "sha256": hashlib.sha256((encoded + "\n").encode()).hexdigest(),
            "sizing": "native; SVG units preserved 1:1",
        }
manifest["canonicalElements"] = 20
manifest["sizePolicy"] = "10 subjects in S and 10 in L; color roles are presentation variants; no scaling"
(ARCHIVE / "checksums.json").write_text(json.dumps(checksums, ensure_ascii=False, indent=2) + "\n")
(LIB / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"canonicalElements": 20, "presentationVariants": 40, "library": str(LIB)}))
