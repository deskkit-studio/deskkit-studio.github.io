/* 멍냥공방 3판~ — 가진 실(필라멘트) 색표. 화면 색 = 실물 색이 되도록 캐릭터·3D 시안·주문 요약이 모두 이 표의 색만 쓴다.
   [표본] 이름·HEX 는 'PLA 무광 12색'을 가정한 값이다. 실제로 가진 실의 제조사 색 번호·실물 색은 첫 출력 전에 대조해 고친다.
   색을 바꾸려면 이 표 한 곳만 고치면 된다. */
(function (root) {
  const LIST = [
    { id: "white",     name: "흰",     hex: "#F4F2EC" },
    { id: "ivory",     name: "아이보리", hex: "#EFE6D2" },
    { id: "cream",     name: "크림",   hex: "#E8D5B0" },
    { id: "beige",     name: "베이지",  hex: "#D4B990" },
    { id: "caramel",   name: "카라멜",  hex: "#B9824F" },
    { id: "brown",     name: "갈색",   hex: "#8A5A3A" },
    { id: "darkbrown", name: "진갈색",  hex: "#4E3628" },
    { id: "gray",      name: "회색",   hex: "#9A9895" },
    { id: "darkgray",  name: "진회색",  hex: "#55524F" },
    { id: "black",     name: "검정",   hex: "#232120" },
    { id: "pink",      name: "분홍",   hex: "#E58A9A" },
    { id: "lightpink", name: "연분홍",  hex: "#F2C4C4" }
  ];
  const MATERIAL = "PLA 무광";
  const byId = id => LIST.find(f => f.id === id);
  const byHex = hex => LIST.find(f => f.hex.toUpperCase() === String(hex).toUpperCase());

  /* 눈에 보이는 색 차이로 가장 가까운 실을 고른다(sRGB → CIE Lab, 거리 ΔE76) */
  function lab(hex) {
    const n = parseInt(hex.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
    const y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    const z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function dist(a, b) { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
  function nearest(hex) {
    let best = LIST[0], bd = Infinity;
    for (const f of LIST) { const d = dist(hex, f.hex); if (d < bd) { bd = d; best = f; } }
    return { ...best, dist: bd };
  }

  /* 4판: 가까운 순서로 n개(후보 칩). 앞이 가장 가깝다 */
  function near(hex, n) { return LIST.map(f => ({ ...f, dist: dist(hex, f.hex) })).sort((a, b) => a.dist - b.dist).slice(0, n || 3); }

  const api = { LIST, MATERIAL, byId, byHex, nearest, near, dist };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MnFil = api;
})(typeof window !== "undefined" ? window : globalThis);
