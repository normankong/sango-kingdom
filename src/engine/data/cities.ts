import type { CityDef } from "../types.ts";

// The 46 cities of ROTK3-era China. Names/positions/adjacency are a faithful
// approximation pending verification against the original game ([Verify] §3.1
// of the design doc). Coordinates are in a 1000x800 viewBox.

interface RawCity {
  id: number;
  name: string;
  han: string;
  x: number;
  y: number;
}

const RAW: RawCity[] = [
  { id: 1, name: "Xiangping", han: "襄平", x: 890, y: 80 },
  { id: 2, name: "Beiping", han: "北平", x: 790, y: 120 },
  { id: 3, name: "Ji", han: "薊", x: 700, y: 140 },
  { id: 4, name: "Jinyang", han: "晉陽", x: 560, y: 210 },
  { id: 5, name: "Nanpi", han: "南皮", x: 720, y: 200 },
  { id: 6, name: "Ye", han: "鄴", x: 640, y: 260 },
  { id: 7, name: "Pingyuan", han: "平原", x: 730, y: 260 },
  { id: 8, name: "Beihai", han: "北海", x: 830, y: 280 },
  { id: 9, name: "Puyang", han: "濮陽", x: 690, y: 320 },
  { id: 10, name: "Chenliu", han: "陳留", x: 640, y: 360 },
  { id: 11, name: "Luoyang", han: "洛陽", x: 540, y: 360 },
  { id: 12, name: "Hongnong", han: "弘農", x: 470, y: 370 },
  { id: 13, name: "Chang'an", han: "長安", x: 390, y: 360 },
  { id: 14, name: "Anding", han: "安定", x: 300, y: 320 },
  { id: 15, name: "Tianshui", han: "天水", x: 250, y: 360 },
  { id: 16, name: "Wuwei", han: "武威", x: 170, y: 280 },
  { id: 17, name: "Xiping", han: "西平", x: 90, y: 330 },
  { id: 18, name: "Xuchang", han: "許昌", x: 610, y: 410 },
  { id: 19, name: "Runan", han: "汝南", x: 640, y: 470 },
  { id: 20, name: "Qiao", han: "譙", x: 720, y: 420 },
  { id: 21, name: "Xiaopei", han: "小沛", x: 770, y: 370 },
  { id: 22, name: "Xiapi", han: "下邳", x: 830, y: 400 },
  { id: 23, name: "Shouchun", han: "壽春", x: 740, y: 480 },
  { id: 24, name: "Lujiang", han: "廬江", x: 770, y: 540 },
  { id: 25, name: "Jianye", han: "建業", x: 860, y: 520 },
  { id: 26, name: "Wu", han: "吳", x: 920, y: 560 },
  { id: 27, name: "Kuaiji", han: "會稽", x: 930, y: 630 },
  { id: 28, name: "Chaisang", han: "柴桑", x: 760, y: 610 },
  { id: 29, name: "Luling", han: "廬陵", x: 800, y: 690 },
  { id: 30, name: "Wan", han: "宛", x: 540, y: 440 },
  { id: 31, name: "Xinye", han: "新野", x: 540, y: 500 },
  { id: 32, name: "Xiangyang", han: "襄陽", x: 520, y: 550 },
  { id: 33, name: "Jiangling", han: "江陵", x: 520, y: 620 },
  { id: 34, name: "Jiangxia", han: "江夏", x: 630, y: 570 },
  { id: 35, name: "Changsha", han: "長沙", x: 640, y: 670 },
  { id: 36, name: "Wuling", han: "武陵", x: 540, y: 680 },
  { id: 37, name: "Guiyang", han: "桂陽", x: 660, y: 740 },
  { id: 38, name: "Lingling", han: "零陵", x: 570, y: 740 },
  { id: 39, name: "Hanzhong", han: "漢中", x: 330, y: 450 },
  { id: 40, name: "Zitong", han: "梓潼", x: 260, y: 500 },
  { id: 41, name: "Chengdu", han: "成都", x: 200, y: 560 },
  { id: 42, name: "Jiangzhou", han: "江州", x: 300, y: 610 },
  { id: 43, name: "Yong'an", han: "永安", x: 390, y: 590 },
  { id: 44, name: "Jianning", han: "建寧", x: 250, y: 700 },
  { id: 45, name: "Yunnan", han: "雲南", x: 160, y: 720 },
  { id: 46, name: "Jiaozhi", han: "交趾", x: 420, y: 770 },
];

// Undirected land/water edges. Naval edges cross the Yangtze or coastal water.
const EDGES: Array<[number, number]> = [
  [1, 2],
  [2, 3],
  [3, 4], [3, 5],
  [4, 6], [4, 13],
  [5, 6], [5, 7],
  [6, 7], [6, 9],
  [7, 8], [7, 9],
  [8, 21], [8, 22],
  [9, 10],
  [10, 11], [10, 18], [10, 21],
  [11, 12], [11, 18], [11, 30],
  [12, 13],
  [13, 14], [13, 15], [13, 30], [13, 39],
  [14, 15], [14, 16],
  [15, 17], [15, 39],
  [16, 17],
  [18, 19], [18, 30],
  [19, 20], [19, 23], [19, 34],
  [20, 21], [20, 23],
  [21, 22],
  [22, 23],
  [23, 24],
  [24, 28],
  [25, 26],
  [26, 27],
  [27, 29],
  [28, 29], [28, 35],
  [29, 37],
  [30, 31],
  [31, 32],
  [32, 33], [32, 34],
  [33, 36], [33, 43],
  [35, 36], [35, 37], [35, 38],
  [37, 38], [37, 46],
  [39, 40],
  [40, 41],
  [41, 42], [41, 44],
  [42, 43], [42, 44],
  [44, 45], [44, 46],
];

const NAVAL_EDGES: Array<[number, number]> = [
  [23, 25],
  [24, 25],
  [28, 34],
  [33, 34],
  [33, 35],
];

function buildCities(): Record<number, CityDef> {
  const cities: Record<number, CityDef> = {};
  for (const c of RAW) {
    cities[c.id] = { ...c, adjacency: [], naval: [] };
  }
  for (const [a, b] of EDGES) {
    cities[a].adjacency.push(b);
    cities[b].adjacency.push(a);
  }
  for (const [a, b] of NAVAL_EDGES) {
    cities[a].adjacency.push(b);
    cities[b].adjacency.push(a);
    cities[a].naval.push(b);
    cities[b].naval.push(a);
  }
  for (const c of Object.values(cities)) {
    c.adjacency.sort((x, y) => x - y);
  }
  return cities;
}

export const CITY_DEFS: Record<number, CityDef> = buildCities();
export const CITY_COUNT = RAW.length;
export const CITY_EDGES: Array<[number, number]> = [...EDGES, ...NAVAL_EDGES];
