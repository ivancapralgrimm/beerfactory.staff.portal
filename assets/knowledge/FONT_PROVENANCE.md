# Local journal display font

Font: Caveat variable weight font, The Caveat Project Authors.
Source downloaded 2026-10-01:
https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf

License: SIL Open Font License 1.1, included verbatim in `OFL.txt`. Copyright notice included; no reserved font name is declared in this license header.

Local transformation: FontTools subset to U+0020–00FF, U+0400–052F and U+2000–206F, retaining the weight axis; output WOFF (`caveat-cyrillic.woff`). CSS uses the scoped alias BF Journal. FontTools code for reproduction:

```python
from fontTools.ttLib import TTFont
from fontTools import subset
f = TTFont("Caveat[wght].ttf")
s = subset.Subsetter()
s.populate(unicodes=list(range(32,256)) + list(range(0x400,0x530)) + list(range(0x2000,0x2070)))
s.subset(f)
f.flavor = "woff"
f.save("caveat-cyrillic.woff")
```

183,108 bytes. Runtime reads the bundled asset, never Google Fonts or GitHub. The generated PWA worker precaches the font. Headings and captions use it; body text uses the existing readable system font. No application dependency was added.
