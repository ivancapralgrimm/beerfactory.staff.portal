ship

Independent final finish review of Hub and Factory Run, 2026-11-07. Reviewed AGENTS.md, Unslop, Hallmark and its independent finish-review instructions. No implementation edits, commits, publication, backend operations or external service writes were made by this reviewer.

No blocking finding remains in the reviewed version.

Resolved findings, independently confirmed against the local compiled application:

1. Keyboard opening of “Разделы” now pauses the game before the global dialog is used. Start → focus “Разделы” → Enter opens “Куда перейдём?” with phase `paused`; score remained 2 during a further 250 ms. Outside focus no longer requires pointer interaction to pause.
2. Expanded help now fits and scrolls at 320 × 568. Actual panel bottom 501.97 px is inside frame bottom 525.19 px; client height 279 px and scroll height 373 px prove the overflow is available through scrolling rather than clipped away.

Visual assessment: inspected actual full screenshots `hub-3d-375.png`, `ready-3d-375.png`, `running-3d-375.png`, `hub-3d-1440.png` and `running-3d-1440.png` in `/workspace/bfstaff-factory-run-evidence/`. Hub clearly presents one playable project. The ready state makes its start action prominent, and the running state leaves a large gesture surface with readable score, lives and pause. The new actual Three.js brewery supplies the distinctive material and character while preserving the quiet Warm Hall portal chrome. The idea “copper brewery runner” describes the page in front of me; there is no material gap. Narrow desktop game framing preserves the existing portal layout and fits this phone-oriented game.

Code and interaction review: the game supports left/right/up/down swipes and tap-to-jump without a directional pad; desktop keyboard controls remain available. Engine generation gives every row two clear exits. Jump/slide timing, damage protection, score and result freeze are coherent. The nine engine tests passed in this confirming round. The source keeps renderer animation inside running gameplay, cancels RAF and observers/listeners on cleanup, and disposes WebGL geometries, materials, textures, environment target and renderer. The Hub draws a static scene without a continuous animation loop. Context-loss handling pauses and recreates the canvas for the Canvas2D fallback. Reduced motion suppresses optional stride/lean/rotation while retaining necessary game movement.

The three rendered Hallmark reports for Hub, ready and running were inspected: each records 0 FAIL, 0 REFLEX, 0 WARN, and one answered F4 source finding. F4 is correctly answered because start/resume and pause render in mutually exclusive phases. Source inspection and actual screenshots agree with that explanation. No waiver is needed for it.

Known minor approximation: collisions use target lane `s.lane`, while the player eases visually through `s.x`. The short transition can resolve a destination-lane interaction before exact visual centering. It does not create an unavoidable blocked row and is not a release blocker for this implementation.

Evidence limits: independent browser checks used local production build `http://127.0.0.1:4418`, Chromium with software WebGL, fixture authentication/data and blocked external transports. The broader authored browser log was reviewed but is not relabelled as independently executed coverage. Physical iPhone touch behavior, actual device GPU FPS, thermal/battery cost and Safari hardware WebGL were not checked. No production/RLS claim is made. Controls and keyboard play were assessed, but the spatial canvas game does not provide equivalent nonvisual gameplay.

Do not dilute the quiet portal chrome, brewery-specific playable world, clear touch surface or two safe exits per obstacle row.
