import type { Muscle } from "./muscles";

/**
 * Body map geometry. Each figure is drawn in a 200 × 420 box centred on x = 100.
 * Paths marked `mirror` describe the figure's left half only and are reflected
 * across the centre line; the rest are drawn whole.
 */
export type Region = { muscle: Muscle; d: string; mirror?: boolean };
export type Figure = { id: "front" | "back"; label: string; regions: Region[]; shapes: string[]; mirroredShapes: string[]; lines: string[] };

const HEAD = "M100 14 C111 14 118 23 118 35 C118 47 110 56 100 56 C90 56 82 47 82 35 C82 23 89 14 100 14 Z";
const NECK = "M92 52 C93 57 93 61 91 65 L109 65 C107 61 107 57 108 52 C103 56 97 56 92 52 Z";

// Shared limb shapes (left half; mirrored)
const HAND = "M44 222 C40 230 40 240 43 246 C47 249 52 247 54 241 C56 233 55 226 53 221 C50 219 46 219 44 222 Z";
const FOOT = "M78 400 C73 404 70 410 72 414 C78 417 88 417 92 413 C93 408 92 403 90 400 C86 398 81 398 78 400 Z";
const KNEE = "M79 306 C78 311 79 316 81 319 C85 321 90 321 93 318 C94 314 94 309 93 305 C89 304 83 304 79 306 Z";
const ELBOW = "M51 158 C50 161 50 163 51 165 C55 168 60 168 64 165 C65 162 65 160 64 158 C60 160 55 160 51 158 Z";
const FOREARM = "M51 168 C47 182 44 198 43 214 C46 218 51 219 54 216 C58 201 62 185 64 169 C60 172 55 172 51 168 Z";
const PELVIS = "M74 206 C82 206 92 206 100 208 L100 222 C94 216 86 212 74 211 Z";

export const FIGURES: Figure[] = [
  {
    id: "front",
    label: "Front",
    shapes: [HEAD, NECK],
    mirroredShapes: [HAND, FOOT, KNEE, ELBOW, PELVIS],
    // decorative separations drawn over the abs
    lines: ["M89 141 L111 141", "M88.5 161 L111.5 161", "M88.5 181 L111.5 181", "M100 122 L100 200"],
    regions: [
      { muscle: "traps", mirror: true, d: "M100 66 L92 66 C86 70 79 72 71 73 C80 76 90 76 100 74 Z" },
      { muscle: "shoulders", mirror: true, d: "M69 75 C59 76 52 84 51 96 C50 105 52 113 55 119 C60 110 66 102 72 97 C74 89 73 81 69 75 Z" },
      { muscle: "chest", mirror: true, d: "M100 79 C91 77 82 77 75 80 C72 87 71 94 72 100 C76 108 83 113 91 114 C95 114 98 113 100 112 Z" },
      { muscle: "biceps", mirror: true, d: "M56 122 C53 133 51 145 51 155 C55 158 61 158 64 155 C67 144 70 131 71 119 C68 112 61 114 56 122 Z" },
      { muscle: "forearms", mirror: true, d: FOREARM },
      { muscle: "abs", d: "M88 121 L112 121 C113.5 145 113.5 172 112 199 C108 206 92 206 88 199 C86.5 172 86.5 145 88 121 Z" },
      { muscle: "obliques", mirror: true, d: "M71 109 C77 115 82 119 85 121 C84 146 84 174 85 200 C81 203 77 204 74 204 C73 190 71 176 70 162 C69 146 69 125 71 109 Z" },
      { muscle: "quads", mirror: true, d: "M74 214 C82 214 91 218 98 226 C98 246 96 270 93 296 C89 302 83 303 79 300 C74 286 70 268 69 248 C68 234 70 222 74 214 Z" },
      { muscle: "calves", mirror: true, d: "M80 324 C76 338 75 354 77 370 C79 381 81 390 83 396 L90 396 C92 384 94 368 94 352 C94 340 93 330 91 323 C87 321 83 321 80 324 Z" },
    ],
  },
  {
    id: "back",
    label: "Back",
    shapes: [HEAD, NECK],
    mirroredShapes: [HAND, FOOT, KNEE, ELBOW],
    lines: ["M100 124 L100 204"],
    regions: [
      { muscle: "traps", mirror: true, d: "M100 60 L93 62 C87 68 79 72 71 74 C80 80 89 92 95 108 L100 122 Z" },
      { muscle: "shoulders", mirror: true, d: "M69 76 C59 77 52 85 51 97 C51 105 53 112 55 118 C60 108 66 100 72 94 C73 87 72 81 69 76 Z" },
      { muscle: "back", mirror: true, d: "M74 86 C81 95 89 105 94 116 L99 128 L99 174 C91 171 85 165 81 157 C75 143 71 127 71 110 C71 101 72 93 74 86 Z" },
      { muscle: "lowerBack", mirror: true, d: "M81 161 C86 168 92 174 99 177 L99 205 C91 205 84 203 79 200 C78 187 79 173 81 161 Z" },
      { muscle: "triceps", mirror: true, d: "M56 121 C53 132 51 144 51 155 C55 158 61 158 64 155 C67 144 70 131 71 118 C68 110 61 112 56 121 Z" },
      { muscle: "forearms", mirror: true, d: FOREARM },
      { muscle: "glutes", mirror: true, d: "M99 209 C90 207 81 207 75 212 C70 222 70 236 73 246 C81 254 91 255 99 251 Z" },
      { muscle: "hamstrings", mirror: true, d: "M73 252 C81 258 90 259 97 255 C98 270 96 286 93 300 C89 304 83 305 79 302 C74 288 71 270 73 252 Z" },
      { muscle: "calves", mirror: true, d: "M79 323 C73 334 72 350 75 364 C78 374 82 382 85 388 L90 388 C94 373 96 356 95 341 C94 331 91 324 87 321 C84 320 81 321 79 323 Z" },
    ],
  },
];
