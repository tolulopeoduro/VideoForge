#!/usr/bin/env python3
"""
Deterministic generator for the seeded shot library (`evals/golden/library_seed.jsonl`, 250 shots)
and labelled golden benchmark (`evals/golden/golden_v1.jsonl`, 25 scenes across domains).
"""
from __future__ import annotations

import json
from pathlib import Path

GOLDEN_DIR = Path(__file__).resolve().parent / "golden"

SCENES_SPEC = [
    {
        "scene_id": "g001",
        "narration": "Our team starts every morning with a quick planning session.",
        "intent": {
            "literal": "people around a table in a bright office",
            "abstract": "collaboration teamwork planning",
            "mood": "energetic",
            "keywords": ["team", "meeting", "office"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (12, "asset_office_1", "people around a table in a bright office collaborating during team meeting", ["team", "meeting", "office", "collaboration", "planning"], 5.0, {"sharpness": 0.9, "stability": 0.9, "mood": "energetic"}),
            (40, "asset_office_2", "colleagues around a conference table in a bright office planning project", ["team", "meeting", "office", "table"], 4.5, {"sharpness": 0.85, "stability": 0.85, "mood": "energetic"}),
        ],
        "bad_shots": [
            (9, "asset_bad_9", "empty dark table in a basement storage room", ["table", "room"], 5.0, {"sharpness": 0.4, "stability": 0.5, "mood": "somber"}),
        ],
    },
    {
        "scene_id": "g002",
        "narration": "Revenue grew steadily throughout the year.",
        "intent": {
            "literal": "rising bar chart on a screen",
            "abstract": "financial growth upward trend profit",
            "mood": "optimistic",
            "keywords": ["chart", "growth", "revenue"],
        },
        "needed_s": 3.0,
        "good_shots": [
            (77, "asset_fin_1", "analytics dashboard with financial growth upward trend profit and revenue chart", ["chart", "growth", "revenue", "financial", "profit"], 4.0, {"sharpness": 0.92, "stability": 0.95, "mood": "optimistic"}),
        ],
        "bad_shots": [
            (3, "asset_bad_3", "rising bar chart on a screen showing server crash error rate", ["bar", "screen", "error"], 4.0, {"sharpness": 0.5, "stability": 0.4, "mood": "tense"}),
        ],
    },
    {
        "scene_id": "g003",
        "narration": "Then we shipped the first version.",
        "intent": {
            "literal": "hands typing code on a laptop",
            "abstract": "software deployment engineering launch",
            "mood": "focused",
            "keywords": ["laptop", "typing", "code"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (21, "asset_dev_1", "hands typing code on a laptop keyboard in modern workspace software engineering", ["laptop", "typing", "code", "engineering"], 4.5, {"sharpness": 0.9, "stability": 0.9, "mood": "focused"}),
        ],
        "bad_shots": [
            (22, "asset_bad_22", "hands typing on a broken vintage typewriter", ["hands", "typing"], 4.0, {"sharpness": 0.45, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g004",
        "narration": "Customers were frustrated by slow checkout times.",
        "intent": {
            "literal": "shopper looking at phone waiting in line",
            "abstract": "impatience delay friction customer frustration",
            "mood": "tense",
            "keywords": ["shopper", "waiting", "phone", "checkout"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (101, "asset_ret_1", "customer waiting in checkout line looking at phone with impatience delay friction", ["shopper", "waiting", "phone", "checkout", "frustration"], 5.0, {"sharpness": 0.88, "stability": 0.85, "mood": "tense"}),
        ],
        "bad_shots": [
            (102, "asset_ret_bad", "shopper looking at phone smiling happily in a park", ["shopper", "phone", "looking"], 5.0, {"sharpness": 0.7, "stability": 0.7, "mood": "happy"}),
        ],
    },
    {
        "scene_id": "g005",
        "narration": "Our cloud infrastructure scales automatically under heavy traffic.",
        "intent": {
            "literal": "server racks with blinking lights in data center",
            "abstract": "cloud scalability high availability network",
            "mood": "futuristic",
            "keywords": ["server", "datacenter", "cloud", "network"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (105, "asset_dc_1", "aisle of server racks with blinking lights in data center cloud scalability network", ["server", "datacenter", "cloud", "network"], 6.0, {"sharpness": 0.95, "stability": 0.9, "mood": "futuristic"}),
        ],
        "bad_shots": [
            (106, "asset_dc_bad", "server racks with blinking lights in a cluttered closet with tangled cables", ["server", "racks", "lights"], 5.0, {"sharpness": 0.4, "stability": 0.4}),
        ],
    },
    {
        "scene_id": "g006",
        "narration": "Renewable energy is transforming the power grid.",
        "intent": {
            "literal": "wind turbines spinning on green hills at sunset",
            "abstract": "clean energy sustainability transition",
            "mood": "inspiring",
            "keywords": ["wind", "turbines", "energy", "sustainability"],
        },
        "needed_s": 5.0,
        "good_shots": [
            (110, "asset_env_1", "aerial view of wind turbines spinning on green hills clean energy sustainability", ["wind", "turbines", "energy", "sustainability"], 6.0, {"sharpness": 0.92, "stability": 0.92, "mood": "inspiring"}),
        ],
        "bad_shots": [
            (111, "asset_env_bad", "smoke rising from coal factory on green hills at sunset", ["hills", "sunset", "factory"], 6.0, {"sharpness": 0.6, "stability": 0.6}),
        ],
    },
    {
        "scene_id": "g007",
        "narration": "Doctors can now review patient scans in seconds.",
        "intent": {
            "literal": "physician examining medical imaging on tablet",
            "abstract": "healthcare diagnostics efficiency clinical",
            "mood": "calm",
            "keywords": ["doctor", "medical", "tablet", "diagnostics"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (115, "asset_med_1", "doctor in clinic examining medical scan on tablet healthcare diagnostics efficiency", ["doctor", "medical", "tablet", "diagnostics"], 5.0, {"sharpness": 0.9, "stability": 0.9, "mood": "calm"}),
        ],
        "bad_shots": [
            (116, "asset_med_bad", "physician examining a broken tablet screen in dark hallway", ["physician", "examining", "tablet"], 4.5, {"sharpness": 0.45, "stability": 0.4}),
        ],
    },
    {
        "scene_id": "g008",
        "narration": "Supply chain bottlenecks stalled global shipments.",
        "intent": {
            "literal": "cargo ship stacked with containers at busy port",
            "abstract": "logistics congestion freight trade",
            "mood": "serious",
            "keywords": ["cargo", "containers", "port", "logistics"],
        },
        "needed_s": 4.5,
        "good_shots": [
            (120, "asset_log_1", "cargo ship stacked with shipping containers at busy port logistics freight trade", ["cargo", "containers", "port", "logistics"], 6.0, {"sharpness": 0.91, "stability": 0.89, "mood": "serious"}),
        ],
        "bad_shots": [
            (121, "asset_log_bad", "toy boat floating in a backyard pool", ["boat", "water"], 5.0, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g009",
        "narration": "Remote teams stay connected across time zones.",
        "intent": {
            "literal": "woman on video call waving at laptop in home office",
            "abstract": "remote work global connection communication",
            "mood": "warm",
            "keywords": ["remote", "videocall", "homeoffice", "laptop"],
        },
        "needed_s": 3.0,
        "good_shots": [
            (125, "asset_rem_1", "woman on video call at laptop in cozy home office remote work global communication", ["remote", "videocall", "homeoffice", "laptop"], 4.5, {"sharpness": 0.89, "stability": 0.9, "mood": "warm"}),
        ],
        "bad_shots": [
            (126, "asset_rem_bad", "woman waving at a taxi on a rainy street", ["woman", "waving"], 4.0, {"sharpness": 0.5, "stability": 0.4}),
        ],
    },
    {
        "scene_id": "g010",
        "narration": "Every morning starts with freshly roasted espresso.",
        "intent": {
            "literal": "barista pouring steamed milk into coffee cup",
            "abstract": "artisan craft morning routine",
            "mood": "cozy",
            "keywords": ["barista", "coffee", "espresso", "cafe"],
        },
        "needed_s": 3.0,
        "good_shots": [
            (130, "asset_caf_1", "barista pouring latte art steamed milk into espresso coffee cup in cafe", ["barista", "coffee", "espresso", "cafe"], 4.0, {"sharpness": 0.93, "stability": 0.88, "mood": "cozy"}),
        ],
        "bad_shots": [
            (131, "asset_caf_bad", "spilled coffee cup on office floor", ["coffee", "cup"], 4.0, {"sharpness": 0.4, "stability": 0.4}),
        ],
    },
    {
        "scene_id": "g011",
        "narration": "Automated warehouse robots sort thousands of parcels per hour.",
        "intent": {
            "literal": "autonomous robots moving packages on warehouse floor",
            "abstract": "automation robotics fulfillment speed",
            "mood": "dynamic",
            "keywords": ["warehouse", "robots", "automation", "packages"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (135, "asset_rob_1", "autonomous robots moving packages across modern warehouse floor automation fulfillment", ["warehouse", "robots", "automation", "packages"], 5.5, {"sharpness": 0.9, "stability": 0.9, "mood": "dynamic"}),
        ],
        "bad_shots": [
            (136, "asset_rob_bad", "abandoned empty warehouse floor with dust", ["warehouse", "floor"], 5.0, {"sharpness": 0.4, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g012",
        "narration": "Security teams monitor threats around the clock.",
        "intent": {
            "literal": "analyst watching multiple monitors in dark control room",
            "abstract": "cybersecurity vigilance threat monitoring",
            "mood": "focused",
            "keywords": ["cybersecurity", "analyst", "monitors", "security"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (140, "asset_sec_1", "security analyst watching multiple monitors in control room cybersecurity threat monitoring", ["cybersecurity", "analyst", "monitors", "security"], 5.0, {"sharpness": 0.91, "stability": 0.92, "mood": "focused"}),
        ],
        "bad_shots": [
            (141, "asset_sec_bad", "gamer playing video game on multiple monitors in dark room", ["watching", "multiple", "monitors", "dark", "room"], 5.0, {"sharpness": 0.55, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g013",
        "narration": "Small businesses struggled to keep their doors open.",
        "intent": {
            "literal": "shop owner flipping sign to closed on glass door",
            "abstract": "economic hardship downturn resilience",
            "mood": "somber",
            "keywords": ["shop", "closed", "smallbusiness", "owner"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (145, "asset_smb_1", "small business shop owner flipping closed sign on glass door economic hardship", ["shop", "closed", "smallbusiness", "owner"], 4.5, {"sharpness": 0.88, "stability": 0.87, "mood": "somber"}),
        ],
        "bad_shots": [
            (146, "asset_smb_bad", "shop owner flipping sign on glass door celebrating grand opening party", ["shop", "owner", "flipping", "sign", "glass", "door"], 4.5, {"sharpness": 0.6, "stability": 0.6, "mood": "happy"}),
        ],
    },
    {
        "scene_id": "g014",
        "narration": "Athletes push past fatigue during early morning training.",
        "intent": {
            "literal": "runner sprinting up stadium stairs at dawn",
            "abstract": "endurance grit determination discipline",
            "mood": "intense",
            "keywords": ["runner", "training", "stairs", "endurance"],
        },
        "needed_s": 3.0,
        "good_shots": [
            (150, "asset_fit_1", "athlete runner sprinting up stadium stairs at dawn endurance grit determination training", ["runner", "training", "stairs", "endurance"], 4.5, {"sharpness": 0.92, "stability": 0.86, "mood": "intense"}),
        ],
        "bad_shots": [
            (151, "asset_fit_bad", "commuter walking slowly down subway stairs at night", ["stairs", "walking"], 4.0, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g015",
        "narration": "Precision agriculture helps farmers conserve water.",
        "intent": {
            "literal": "drone flying over irrigated green farmland",
            "abstract": "agritech smart farming conservation",
            "mood": "calm",
            "keywords": ["drone", "farmland", "agriculture", "irrigation"],
        },
        "needed_s": 4.5,
        "good_shots": [
            (155, "asset_agr_1", "agricultural drone flying over irrigated green farmland agritech smart farming conservation", ["drone", "farmland", "agriculture", "irrigation"], 6.0, {"sharpness": 0.91, "stability": 0.9, "mood": "calm"}),
        ],
        "bad_shots": [
            (156, "asset_agr_bad", "drone flying over concrete parking lot in city", ["drone", "flying", "over"], 5.0, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g016",
        "narration": "Designers iterate rapidly on mobile interfaces.",
        "intent": {
            "literal": "hands arranging wireframe sketches and color swatches on desk",
            "abstract": "ui ux design prototyping creativity",
            "mood": "creative",
            "keywords": ["design", "wireframe", "ux", "prototyping"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (160, "asset_ux_1", "product designer arranging wireframe sketches and color swatches ui ux design prototyping", ["design", "wireframe", "ux", "prototyping"], 5.0, {"sharpness": 0.9, "stability": 0.91, "mood": "creative"}),
        ],
        "bad_shots": [
            (161, "asset_ux_bad", "hands arranging messy tax receipts on desk", ["hands", "arranging", "desk"], 4.5, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g017",
        "narration": "Electric vehicles are rapidly replacing combustion fleets.",
        "intent": {
            "literal": "electric car plugged into charging station on city street",
            "abstract": "clean mobility electrification transport",
            "mood": "modern",
            "keywords": ["electric", "charging", "ev", "car"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (165, "asset_ev_1", "electric car plugged into fast charging station clean mobility electrification", ["electric", "charging", "ev", "car"], 5.0, {"sharpness": 0.92, "stability": 0.9, "mood": "modern"}),
        ],
        "bad_shots": [
            (166, "asset_ev_bad", "old diesel truck idling on city street", ["city", "street", "vehicle"], 5.0, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g018",
        "narration": "Students learn faster with interactive simulations.",
        "intent": {
            "literal": "students wearing vr headsets in modern classroom",
            "abstract": "edtech immersive learning education",
            "mood": "curious",
            "keywords": ["students", "classroom", "vr", "education"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (170, "asset_edu_1", "students wearing vr headsets in classroom edtech immersive learning education", ["students", "classroom", "vr", "education"], 5.0, {"sharpness": 0.9, "stability": 0.88, "mood": "curious"}),
        ],
        "bad_shots": [
            (171, "asset_edu_bad", "students sleeping at desks in empty lecture hall", ["students", "classroom"], 5.0, {"sharpness": 0.45, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g019",
        "narration": "Biotech researchers sequence samples with high-throughput instruments.",
        "intent": {
            "literal": "scientist pipetting liquid into microplate in laboratory",
            "abstract": "biotechnology genomics research precision",
            "mood": "focused",
            "keywords": ["scientist", "laboratory", "pipette", "biotech"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (175, "asset_bio_1", "scientist pipetting sample into microplate in laboratory biotechnology genomics research", ["scientist", "laboratory", "pipette", "biotech"], 4.5, {"sharpness": 0.93, "stability": 0.92, "mood": "focused"}),
        ],
        "bad_shots": [
            (176, "asset_bio_bad", "bartender pouring drink into glass at nightclub", ["pouring", "liquid"], 4.0, {"sharpness": 0.5, "stability": 0.5}),
        ],
    },
    {
        "scene_id": "g020",
        "narration": "Families gather outdoors to celebrate the weekend.",
        "intent": {
            "literal": "parents and children sharing picnic on sunny park lawn",
            "abstract": "togetherness family joy leisure",
            "mood": "warm",
            "keywords": ["family", "picnic", "park", "outdoors"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (180, "asset_fam_1", "parents and children sharing picnic on sunny park lawn togetherness family joy", ["family", "picnic", "park", "outdoors"], 5.0, {"sharpness": 0.9, "stability": 0.88, "mood": "warm"}),
        ],
        "bad_shots": [
            (181, "asset_fam_bad", "empty park bench in heavy rain", ["park", "bench"], 5.0, {"sharpness": 0.4, "stability": 0.4}),
        ],
    },
    # Hard cases where literal phrasing overlaps with a wrong-sense distractor, while abstract intent disambiguates
    {
        "scene_id": "g021",
        "narration": "After the outage, our engineering team showed incredible resilience.",
        "intent": {
            "literal": "engineers working late under pressure",
            "abstract": "resilience recovery problem solving",
            "mood": "determined",
            "keywords": ["engineers", "incident", "recovery"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (185, "asset_res_1", "software engineers fixing incident recovery problem solving resilience in war room", ["engineers", "incident", "recovery", "resilience"], 5.0, {"sharpness": 0.92, "stability": 0.9, "mood": "determined"}),
        ],
        "bad_shots": [
            (186, "asset_res_bad", "engineers working late under pressure arguing and quitting in frustration", ["engineers", "working", "late", "pressure"], 5.0, {"sharpness": 0.85, "stability": 0.85, "mood": "tense"}),
        ],
    },
    {
        "scene_id": "g022",
        "narration": "Breaking down silos created real synergy across departments.",
        "intent": {
            "literal": "two teams meeting across glass bridge",
            "abstract": "cross functional synergy alignment unity",
            "mood": "inspiring",
            "keywords": ["teams", "alignment", "bridge"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (187, "asset_syn_1", "cross functional teams shaking hands in atrium synergy alignment unity", ["teams", "alignment", "synergy", "unity"], 5.0, {"sharpness": 0.91, "stability": 0.9, "mood": "inspiring"}),
        ],
        "bad_shots": [
            (188, "asset_syn_bad", "two teams meeting across glass bridge walking past each other ignoring", ["two", "teams", "meeting", "across", "glass", "bridge"], 5.0, {"sharpness": 0.82, "stability": 0.8, "mood": "cold"}),
        ],
    },
    {
        "scene_id": "g023",
        "narration": "Legacy bureaucracy was weighing the organization down.",
        "intent": {
            "literal": "stacks of paper folders on desk",
            "abstract": "bureaucracy red tape inefficiency",
            "mood": "somber",
            "keywords": ["paperwork", "folders", "bureaucracy"],
        },
        "needed_s": 3.5,
        "good_shots": [
            (189, "asset_bur_1", "overwhelmed clerk buried in paperwork folders bureaucracy red tape inefficiency", ["paperwork", "folders", "bureaucracy"], 4.5, {"sharpness": 0.9, "stability": 0.9, "mood": "somber"}),
        ],
        "bad_shots": [
            (190, "asset_bur_bad", "stacks of paper folders on desk neatly organized in bright stationery store", ["stacks", "paper", "folders", "desk"], 4.5, {"sharpness": 0.85, "stability": 0.85, "mood": "cheerful"}),
        ],
    },
    {
        "scene_id": "g024",
        "narration": "A single spark of innovation changed the entire product roadmap.",
        "intent": {
            "literal": "founder sketching idea on glass wall",
            "abstract": "breakthrough innovation inspiration",
            "mood": "energetic",
            "keywords": ["founder", "whiteboard", "innovation"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (191, "asset_inn_1", "founder drawing product roadmap on whiteboard breakthrough innovation inspiration", ["founder", "whiteboard", "innovation", "breakthrough"], 5.0, {"sharpness": 0.93, "stability": 0.91, "mood": "energetic"}),
        ],
        "bad_shots": [
            (192, "asset_inn_bad", "founder sketching idea on glass wall erasing failed numbers in empty room", ["founder", "sketching", "idea", "glass", "wall"], 5.0, {"sharpness": 0.8, "stability": 0.8, "mood": "somber"}),
        ],
    },
    {
        "scene_id": "g025",
        "narration": "Customer trust is built on transparency and reliability.",
        "intent": {
            "literal": "advisor reviewing contract with client at table",
            "abstract": "trust transparency partnership reliability",
            "mood": "warm",
            "keywords": ["advisor", "client", "trust", "partnership"],
        },
        "needed_s": 4.0,
        "good_shots": [
            (193, "asset_tru_1", "advisor and client smiling over agreement trust transparency partnership reliability", ["advisor", "client", "trust", "partnership"], 5.0, {"sharpness": 0.92, "stability": 0.92, "mood": "warm"}),
        ],
        "bad_shots": [
            (194, "asset_tru_bad", "advisor reviewing contract with client at table arguing over fine print", ["advisor", "reviewing", "contract", "client", "table"], 5.0, {"sharpness": 0.82, "stability": 0.82, "mood": "tense"}),
        ],
    },
]


def main() -> None:
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    shots: list[dict] = []
    golden_rows: list[dict] = []
    used_ids: set[int] = set()

    for spec in SCENES_SPEC:
        acc_ids: list[str] = []
        rej_ids: list[str] = []

        for sid, asset_id, caption, tags, dur_s, qual in spec["good_shots"]:
            used_ids.add(sid)
            acc_ids.append(f"shot_{sid}")
            shots.append(
                {
                    "id": sid,
                    "asset_id": asset_id,
                    "start_us": 0,
                    "end_us": int(round(dur_s * 1_000_000)),
                    "width": 1920,
                    "height": 1080,
                    "caption": caption,
                    "tags": tags,
                    "search_text": f"{caption} {' '.join(tags)}",
                    "quality": {"has_text": False, **qual},
                }
            )

        for sid, asset_id, caption, tags, dur_s, qual in spec["bad_shots"]:
            used_ids.add(sid)
            rej_ids.append(f"shot_{sid}")
            shots.append(
                {
                    "id": sid,
                    "asset_id": asset_id,
                    "start_us": 0,
                    "end_us": int(round(dur_s * 1_000_000)),
                    "width": 1920,
                    "height": 1080,
                    "caption": caption,
                    "tags": tags,
                    "search_text": f"{caption} {' '.join(tags)}",
                    "quality": {"has_text": False, **qual},
                }
            )

        golden_rows.append(
            {
                "scene_id": spec["scene_id"],
                "narration": spec["narration"],
                "intent": spec["intent"],
                "needed_s": spec["needed_s"],
                "acceptable": acc_ids,
                "rejected": rej_ids,
                "notes": "Seeded v1 golden benchmark",
            }
        )

    # Add 200+ additional background/distractor shots (including watermarked, short, portrait, low-res, and general b-roll)
    topics = [
        ("city traffic timelapse at dusk", ["traffic", "city", "highway"]),
        ("ocean waves crashing on rocky shore", ["ocean", "waves", "coast"]),
        ("chef chopping vegetables in commercial kitchen", ["chef", "kitchen", "cooking"]),
        ("construction crane lifting steel beam", ["construction", "crane", "building"]),
        ("musician playing acoustic guitar in studio", ["music", "guitar", "studio"]),
        ("airplane taking off from airport runway", ["airplane", "airport", "travel"]),
        ("mountain hiker looking at valley view", ["mountain", "hiking", "nature"]),
        ("stock ticker board in financial district", ["stocks", "market", "ticker"]),
        ("librarian shelving books in university library", ["library", "books", "study"]),
        ("solar panels gleaming on residential roof", ["solar", "roof", "energy"]),
    ]

    next_id = 200
    while len(shots) < 250:
        while next_id in used_ids:
            next_id += 1
        idx = len(shots) % len(topics)
        base_caption, base_tags = topics[idx]
        has_watermark = (next_id % 17 == 0)
        is_short = (next_id % 19 == 0)
        dur_us = 1_000_000 if is_short else 5_000_000
        shots.append(
            {
                "id": next_id,
                "asset_id": f"asset_bg_{next_id // 3}",
                "start_us": 0,
                "end_us": dur_us,
                "width": 1920,
                "height": 1080,
                "caption": f"{base_caption} take {next_id}",
                "tags": base_tags,
                "search_text": f"{base_caption} {' '.join(base_tags)}",
                "quality": {
                    "has_text": has_watermark,
                    "sharpness": 0.75,
                    "stability": 0.8,
                },
            }
        )
        used_ids.add(next_id)
        next_id += 1

    shots.sort(key=lambda r: r["id"])

    with open(GOLDEN_DIR / "library_seed.jsonl", "w", encoding="utf-8") as f:
        for s in shots:
            f.write(json.dumps(s) + "\n")

    with open(GOLDEN_DIR / "golden_v1.jsonl", "w", encoding="utf-8") as f:
        for g in golden_rows:
            f.write(json.dumps(g) + "\n")

    print(f"Wrote {len(shots)} shots to library_seed.jsonl and {len(golden_rows)} scenes to golden_v1.jsonl")


if __name__ == "__main__":
    main()
