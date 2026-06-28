import type { RGB } from "./color";
import { deltaE2000, hexToRgb, rgbToHsv, rgbToLab, type Lab } from "./color";

/** 日本の伝統色（和名）。出典: NIPPON COLORS（250色）。 */
export type NamedColor = { ja: string; romaji: string; hex: string };

export const TRADITIONAL_COLORS: NamedColor[] = [
  { ja: "撫子", romaji: "nadeshiko", hex: "#DC9FB4" },
  { ja: "紅梅", romaji: "kohbai", hex: "#E16B8C" },
  { ja: "蘇芳", romaji: "suoh", hex: "#8E354A" },
  { ja: "退紅", romaji: "taikoh", hex: "#F8C3CD" },
  { ja: "一斥染", romaji: "ikkonzome", hex: "#F4A7B9" },
  { ja: "桑染", romaji: "kuwazome", hex: "#64363C" },
  { ja: "桃", romaji: "momo", hex: "#F596AA" },
  { ja: "苺", romaji: "ichigo", hex: "#B5495B" },
  { ja: "薄紅", romaji: "usubeni", hex: "#E87A90" },
  { ja: "今様", romaji: "imayoh", hex: "#D05A6E" },
  { ja: "中紅", romaji: "nakabeni", hex: "#DB4D6D" },
  { ja: "桜", romaji: "sakura", hex: "#FEDFE1" },
  { ja: "梅鼠", romaji: "umenezumi", hex: "#9E7A7A" },
  { ja: "韓紅花", romaji: "karakurenai", hex: "#D0104C" },
  { ja: "燕脂", romaji: "enji", hex: "#9F353A" },
  { ja: "紅", romaji: "kurenai", hex: "#CB1B45" },
  { ja: "鴇", romaji: "toki", hex: "#EEA9A9" },
  { ja: "長春", romaji: "cyohsyun", hex: "#BF6766" },
  { ja: "深緋", romaji: "kokiake", hex: "#86473F" },
  { ja: "桜鼠", romaji: "sakuranezumi", hex: "#B19693" },
  { ja: "甚三紅", romaji: "jinzamomi", hex: "#EB7A77" },
  { ja: "小豆", romaji: "azuki", hex: "#954A45" },
  { ja: "蘇芳香", romaji: "suohkoh", hex: "#A96360" },
  { ja: "赤紅", romaji: "akabeni", hex: "#CB4042" },
  { ja: "真朱", romaji: "shinsyu", hex: "#AB3B3A" },
  { ja: "灰桜", romaji: "haizakura", hex: "#D7C4BB" },
  { ja: "栗梅", romaji: "kuriume", hex: "#904840" },
  { ja: "海老茶", romaji: "ebicha", hex: "#734338" },
  { ja: "銀朱", romaji: "ginsyu", hex: "#C73E3A" },
  { ja: "黒鳶", romaji: "kurotobi", hex: "#554236" },
  { ja: "紅鳶", romaji: "benitobi", hex: "#994639" },
  { ja: "曙", romaji: "akebono", hex: "#F19483" },
  { ja: "紅樺", romaji: "benikaba", hex: "#B54434" },
  { ja: "水がき", romaji: "mizugaki", hex: "#B9887D" },
  { ja: "珊瑚朱", romaji: "sangosyu", hex: "#F17C67" },
  { ja: "紅檜皮", romaji: "benihiwada", hex: "#884C3A" },
  { ja: "猩猩緋", romaji: "syojyohi", hex: "#E83015" },
  { ja: "鉛丹", romaji: "entan", hex: "#D75455" },
  { ja: "芝翫茶", romaji: "shikancha", hex: "#B55D4C" },
  { ja: "檜皮", romaji: "hiwada", hex: "#854836" },
  { ja: "柿渋", romaji: "kakishibu", hex: "#A35E47" },
  { ja: "緋", romaji: "ake", hex: "#CC543A" },
  { ja: "鳶", romaji: "tobi", hex: "#724832" },
  { ja: "紅緋", romaji: "benihi", hex: "#F75C2F" },
  { ja: "栗皮茶", romaji: "kurikawacha", hex: "#6A4028" },
  { ja: "弁柄", romaji: "bengara", hex: "#9A5034" },
  { ja: "照柿", romaji: "terigaki", hex: "#C46243" },
  { ja: "江戸茶", romaji: "edocha", hex: "#AF5F3C" },
  { ja: "洗朱", romaji: "araisyu", hex: "#FB966E" },
  { ja: "百塩茶", romaji: "momoshiocha", hex: "#724938" },
  { ja: "唐茶", romaji: "karacha", hex: "#B47157" },
  { ja: "ときがら茶", romaji: "tokigaracha", hex: "#DB8E71" },
  { ja: "黄丹", romaji: "ohni", hex: "#F05E1C" },
  { ja: "纁", romaji: "sohi", hex: "#ED784A" },
  { ja: "遠州茶", romaji: "ensyucha", hex: "#CA7853" },
  { ja: "樺茶", romaji: "kabacha", hex: "#B35C37" },
  { ja: "焦茶", romaji: "kogecha", hex: "#563F2E" },
  { ja: "赤香", romaji: "akakoh", hex: "#E3916E" },
  { ja: "雀茶", romaji: "suzumecha", hex: "#8F5A3C" },
  { ja: "宍", romaji: "shishi", hex: "#F0A986" },
  { ja: "宗伝唐茶", romaji: "sodenkaracha", hex: "#A0674B" },
  { ja: "樺", romaji: "kaba", hex: "#C1693C" },
  { ja: "深支子", romaji: "kokikuchinashi", hex: "#FB9966" },
  { ja: "胡桃", romaji: "kurumi", hex: "#947A6D" },
  { ja: "代赭", romaji: "taisya", hex: "#A36336" },
  { ja: "洗柿", romaji: "araigaki", hex: "#E79460" },
  { ja: "黄櫨染", romaji: "kohrozen", hex: "#7D532C" },
  { ja: "赤朽葉", romaji: "akakuchiba", hex: "#C78550" },
  { ja: "礪茶", romaji: "tonocha", hex: "#985F2A" },
  { ja: "赤白橡", romaji: "akashirotsurubami", hex: "#E1A679" },
  { ja: "煎茶", romaji: "sencha", hex: "#855B32" },
  { ja: "萱草", romaji: "kanzo", hex: "#FC9F4D" },
  { ja: "洒落柿", romaji: "sharegaki", hex: "#FFBA84" },
  { ja: "紅鬱金", romaji: "beniukon", hex: "#E98B2A" },
  { ja: "梅染", romaji: "umezome", hex: "#E9A368" },
  { ja: "枇杷茶", romaji: "biwacha", hex: "#B17844" },
  { ja: "丁子茶", romaji: "chojicha", hex: "#96632E" },
  { ja: "憲法染", romaji: "kenpohzome", hex: "#43341B" },
  { ja: "琥珀", romaji: "kohaku", hex: "#CA7A2C" },
  { ja: "薄柿", romaji: "usugaki", hex: "#ECB88A" },
  { ja: "伽羅", romaji: "kyara", hex: "#78552B" },
  { ja: "丁子染", romaji: "chojizome", hex: "#B07736" },
  { ja: "柴染", romaji: "fushizome", hex: "#967249" },
  { ja: "朽葉", romaji: "kuchiba", hex: "#E2943B" },
  { ja: "金茶", romaji: "kincha", hex: "#C7802D" },
  { ja: "狐", romaji: "kitsune", hex: "#9B6E23" },
  { ja: "煤竹", romaji: "susutake", hex: "#6E552F" },
  { ja: "薄香", romaji: "usukoh", hex: "#EBB471" },
  { ja: "砥粉", romaji: "tonoko", hex: "#D7B98E" },
  { ja: "銀煤竹", romaji: "ginsusutake", hex: "#82663A" },
  { ja: "黄土", romaji: "ohdo", hex: "#B68E55" },
  { ja: "白茶", romaji: "shiracha", hex: "#BC9F77" },
  { ja: "媚茶", romaji: "kobicha", hex: "#876633" },
  { ja: "黄唐茶", romaji: "kigaracha", hex: "#C18A26" },
  { ja: "山吹", romaji: "yamabuki", hex: "#FFB11B" },
  { ja: "山吹茶", romaji: "yamabukicha", hex: "#D19826" },
  { ja: "櫨染", romaji: "hajizome", hex: "#DDA52D" },
  { ja: "桑茶", romaji: "kuwacha", hex: "#C99833" },
  { ja: "玉子", romaji: "tamago", hex: "#F9BF45" },
  { ja: "白橡", romaji: "shirotsurubami", hex: "#DCB879" },
  { ja: "黄橡", romaji: "kitsurubami", hex: "#BA9132" },
  { ja: "玉蜀黍", romaji: "tamamorokoshi", hex: "#E8B647" },
  { ja: "花葉", romaji: "hanaba", hex: "#F7C242" },
  { ja: "生壁", romaji: "namakabe", hex: "#7D6C46" },
  { ja: "鳥の子", romaji: "torinoko", hex: "#DAC9A6" },
  { ja: "浅黄", romaji: "usuki", hex: "#FAD689" },
  { ja: "黄朽葉", romaji: "kikuchiba", hex: "#D9AB42" },
  { ja: "梔子", romaji: "kuchinashi", hex: "#F6C555" },
  { ja: "籐黄", romaji: "tohoh", hex: "#FFC408" },
  { ja: "鬱金", romaji: "ukon", hex: "#EFBB24" },
  { ja: "芥子", romaji: "karashi", hex: "#CAAD5F" },
  { ja: "肥後煤竹", romaji: "higosusutake", hex: "#8D742A" },
  { ja: "利休白茶", romaji: "rikyushiracha", hex: "#B4A582" },
  { ja: "灰汁", romaji: "aku", hex: "#877F6C" },
  { ja: "利休茶", romaji: "rikyucha", hex: "#897D55" },
  { ja: "路考茶", romaji: "rokohcha", hex: "#74673E" },
  { ja: "菜種油", romaji: "nataneyu", hex: "#A28C37" },
  { ja: "鶯茶", romaji: "uguisucha", hex: "#6C6024" },
  { ja: "黄海松茶", romaji: "kimirucha", hex: "#867835" },
  { ja: "海松茶", romaji: "mirucha", hex: "#62592C" },
  { ja: "刈安", romaji: "kariyasu", hex: "#E9CD4C" },
  { ja: "菜の花", romaji: "nanohana", hex: "#F7D94C" },
  { ja: "黄蘗", romaji: "kihada", hex: "#FBE251" },
  { ja: "蒸栗", romaji: "mushikuri", hex: "#D9CD90" },
  { ja: "青朽葉", romaji: "aokuchiba", hex: "#ADA142" },
  { ja: "女郎花", romaji: "ominaeshi", hex: "#DDD23B" },
  { ja: "鶸茶", romaji: "hiwacha", hex: "#A5A051" },
  { ja: "鶸", romaji: "hiwa", hex: "#BEC23F" },
  { ja: "鶯", romaji: "uguisu", hex: "#6C6A2D" },
  { ja: "柳茶", romaji: "yanagicha", hex: "#939650" },
  { ja: "苔", romaji: "koke", hex: "#838A2D" },
  { ja: "麹塵", romaji: "kikujin", hex: "#B1B479" },
  { ja: "璃寛茶", romaji: "rikancha", hex: "#616138" },
  { ja: "藍媚茶", romaji: "aikobicha", hex: "#4B4E2A" },
  { ja: "海松", romaji: "miru", hex: "#5B622E" },
  { ja: "千歳茶", romaji: "sensaicha", hex: "#4D5139" },
  { ja: "梅幸茶", romaji: "baikocha", hex: "#89916B" },
  { ja: "鶸萌黄", romaji: "hiwamoegi", hex: "#90B44B" },
  { ja: "柳染", romaji: "yanagizome", hex: "#91AD70" },
  { ja: "裏柳", romaji: "urayanagi", hex: "#B5CAA0" },
  { ja: "岩井茶", romaji: "iwaicha", hex: "#646A58" },
  { ja: "萌黄", romaji: "moegi", hex: "#7BA23F" },
  { ja: "苗", romaji: "nae", hex: "#86C166" },
  { ja: "柳煤竹", romaji: "yanagisusutake", hex: "#4A593D" },
  { ja: "松葉", romaji: "matsuba", hex: "#42602D" },
  { ja: "青丹", romaji: "aoni", hex: "#516E41" },
  { ja: "薄青", romaji: "usuao", hex: "#91B493" },
  { ja: "柳鼠", romaji: "yanaginezumi", hex: "#808F7C" },
  { ja: "常磐", romaji: "tokiwa", hex: "#1B813E" },
  { ja: "若竹", romaji: "wakatake", hex: "#5DAC81" },
  { ja: "千歳緑", romaji: "chitosemidori", hex: "#36563C" },
  { ja: "緑", romaji: "midori", hex: "#227D51" },
  { ja: "白緑", romaji: "byakuroku", hex: "#A8D8B9" },
  { ja: "老竹", romaji: "oitake", hex: "#6A8372" },
  { ja: "木賊", romaji: "tokusa", hex: "#2D6D4B" },
  { ja: "御納戸茶", romaji: "onandocha", hex: "#465D4C" },
  { ja: "緑青", romaji: "rokusyoh", hex: "#24936E" },
  { ja: "錆青磁", romaji: "sabiseiji", hex: "#86A697" },
  { ja: "青竹", romaji: "aotake", hex: "#00896C" },
  { ja: "ビロード", romaji: "veludo", hex: "#096148" },
  { ja: "虫襖", romaji: "mushiao", hex: "#20604F" },
  { ja: "藍海松茶", romaji: "aimirucha", hex: "#0F4C3A" },
  { ja: "沈香茶", romaji: "tonocha2", hex: "#4F726C" },
  { ja: "青緑", romaji: "aomidori", hex: "#00AA90" },
  { ja: "青磁", romaji: "seiji", hex: "#69B0AC" },
  { ja: "鉄", romaji: "tetsu", hex: "#26453D" },
  { ja: "水浅葱", romaji: "mizuasagi", hex: "#66BAB7" },
  { ja: "青碧", romaji: "seiheki", hex: "#268785" },
  { ja: "錆鉄御納戸", romaji: "sabitetsuonando", hex: "#405B55" },
  { ja: "高麗納戸", romaji: "korainando", hex: "#305A56" },
  { ja: "白群", romaji: "byakugun", hex: "#78C2C4" },
  { ja: "御召茶", romaji: "omeshicha", hex: "#376B6D" },
  { ja: "瓶覗", romaji: "kamenozoki", hex: "#A5DEE4" },
  { ja: "深川鼠", romaji: "fukagawanezumi", hex: "#77969A" },
  { ja: "錆浅葱", romaji: "sabiasagi", hex: "#6699A1" },
  { ja: "水", romaji: "mizu", hex: "#81C7D4" },
  { ja: "浅葱", romaji: "asagi", hex: "#33A6B8" },
  { ja: "御納戸", romaji: "onando", hex: "#0C4842" },
  { ja: "藍", romaji: "ai", hex: "#0D5661" },
  { ja: "新橋", romaji: "shinbashi", hex: "#0089A7" },
  { ja: "錆御納戸", romaji: "sabionando", hex: "#336774" },
  { ja: "鉄御納戸", romaji: "tetsuonando", hex: "#255359" },
  { ja: "花浅葱", romaji: "hanaasagi", hex: "#1E88A8" },
  { ja: "藍鼠", romaji: "ainezumi", hex: "#566C73" },
  { ja: "舛花", romaji: "masuhana", hex: "#577C8A" },
  { ja: "空", romaji: "sora", hex: "#58B2DC" },
  { ja: "熨斗目花", romaji: "noshimehana", hex: "#2B5F75" },
  { ja: "千草", romaji: "chigusa", hex: "#3A8FB7" },
  { ja: "御召御納戸", romaji: "omeshionando", hex: "#2E5C6E" },
  { ja: "縹", romaji: "hanada", hex: "#006284" },
  { ja: "勿忘草", romaji: "wasurenagusa", hex: "#7DB9DE" },
  { ja: "群青", romaji: "gunjyo", hex: "#51A8DD" },
  { ja: "露草", romaji: "tsuyukusa", hex: "#2EA9DF" },
  { ja: "黒橡", romaji: "kurotsurubami", hex: "#0B1013" },
  { ja: "紺", romaji: "kon", hex: "#0F2540" },
  { ja: "褐", romaji: "kachi", hex: "#08192D" },
  { ja: "瑠璃", romaji: "ruri", hex: "#005CAF" },
  { ja: "瑠璃紺", romaji: "rurikon", hex: "#0B346E" },
  { ja: "紅碧", romaji: "benimidori", hex: "#7B90D2" },
  { ja: "藤鼠", romaji: "fujinezumi", hex: "#6E75A4" },
  { ja: "鉄紺", romaji: "tetsukon", hex: "#261E47" },
  { ja: "紺青", romaji: "konjyo", hex: "#113285" },
  { ja: "紅掛花", romaji: "benikakehana", hex: "#4E4F97" },
  { ja: "紺桔梗", romaji: "konkikyo", hex: "#211E55" },
  { ja: "藤", romaji: "fuji", hex: "#8B81C3" },
  { ja: "二藍", romaji: "futaai", hex: "#70649A" },
  { ja: "楝", romaji: "ouchi", hex: "#9B90C2" },
  { ja: "藤紫", romaji: "fujimurasaki", hex: "#8A6BBE" },
  { ja: "桔梗", romaji: "kikyo", hex: "#6A4C9C" },
  { ja: "紫苑", romaji: "shion", hex: "#8F77B5" },
  { ja: "滅紫", romaji: "messhi", hex: "#533D5B" },
  { ja: "薄", romaji: "usu", hex: "#B28FCE" },
  { ja: "半", romaji: "hashita", hex: "#986DB2" },
  { ja: "江戸紫", romaji: "edomurasaki", hex: "#77428D" },
  { ja: "紫紺", romaji: "shikon", hex: "#3C2F41" },
  { ja: "深紫", romaji: "kokimurasaki", hex: "#4A225D" },
  { ja: "菫", romaji: "sumire", hex: "#66327C" },
  { ja: "紫", romaji: "murasaki", hex: "#592C63" },
  { ja: "菖蒲", romaji: "ayame", hex: "#6F3381" },
  { ja: "藤煤竹", romaji: "fujisusutake", hex: "#574C57" },
  { ja: "紅藤", romaji: "benifuji", hex: "#B481BB" },
  { ja: "黒紅", romaji: "kurobeni", hex: "#3F2B36" },
  { ja: "茄子紺", romaji: "nasukon", hex: "#572A3F" },
  { ja: "葡萄鼠", romaji: "budohnezumi", hex: "#5E3D50" },
  { ja: "鳩羽鼠", romaji: "hatobanezumi", hex: "#72636E" },
  { ja: "杜若", romaji: "kakitsubata", hex: "#622954" },
  { ja: "蒲葡", romaji: "ebizome", hex: "#6D2E5B" },
  { ja: "牡丹", romaji: "botan", hex: "#C1328E" },
  { ja: "梅紫", romaji: "umemurasaki", hex: "#A8497A" },
  { ja: "似紫", romaji: "nisemurasaki", hex: "#562E37" },
  { ja: "躑躅", romaji: "tsutsuji", hex: "#E03C8A" },
  { ja: "紫鳶", romaji: "murasakitobi", hex: "#60373E" },
  { ja: "白練", romaji: "shironeri", hex: "#FCFAF2" },
  { ja: "胡粉", romaji: "gofun", hex: "#FFFFFB" },
  { ja: "白鼠", romaji: "shironezumi", hex: "#BDC0BA" },
  { ja: "銀鼠", romaji: "ginnezumi", hex: "#91989F" },
  { ja: "鉛", romaji: "namari", hex: "#787878" },
  { ja: "灰", romaji: "hai", hex: "#828282" },
  { ja: "素鼠", romaji: "sunezumi", hex: "#787D7B" },
  { ja: "利休鼠", romaji: "rikyunezumi", hex: "#707C74" },
  { ja: "鈍", romaji: "nibi", hex: "#656765" },
  { ja: "青鈍", romaji: "aonibi", hex: "#535953" },
  { ja: "溝鼠", romaji: "dobunezumi", hex: "#4F4F48" },
  { ja: "紅消鼠", romaji: "benikeshinezumi", hex: "#52433D" },
  { ja: "藍墨茶", romaji: "aisumicha", hex: "#373C38" },
  { ja: "檳榔子染", romaji: "binrojizome", hex: "#3A3226" },
  { ja: "消炭", romaji: "keshizumi", hex: "#434343" },
  { ja: "墨", romaji: "sumi", hex: "#1C1C1C" },
  { ja: "黒", romaji: "kuro", hex: "#080808" },
  { ja: "呂", romaji: "ro", hex: "#0C0C0C" },];

// 起動時に各色のLabを展開（毎回の探索コストを抑える）。
const PALETTE: { color: NamedColor; lab: Lab }[] = TRADITIONAL_COLORS.map((color) => ({
  color,
  lab: rgbToLab(hexToRgb(color.hex)!),
}));

export type ColorMatch = { color: NamedColor; deltaE: number };

/** 採色した色に最も近い伝統色を CIEDE2000（知覚色差）で判定。 */
export function nearestColorName(rgb: RGB): ColorMatch {
  const lab = rgbToLab(rgb);
  let color = PALETTE[0].color;
  let deltaE = Infinity;
  for (const e of PALETTE) {
    const d = deltaE2000(lab, e.lab);
    if (d < deltaE) {
      deltaE = d;
      color = e.color;
    }
  }
  return { color, deltaE };
}

/** ΔE2000 に基づく一致度ラベル（誤解を避けるための正直な近さ表示）。 */
export function closenessLabel(deltaE: number): string {
  if (deltaE < 2.3) return "ほぼ一致";
  if (deltaE < 5) return "とても近い";
  if (deltaE < 10) return "近い";
  if (deltaE < 16) return "やや近い";
  return "近い系統";
}

const HUE_NAMES: { max: number; name: string }[] = [
  { max: 11, name: "赤" },
  { max: 40, name: "橙" },
  { max: 67, name: "黄" },
  { max: 110, name: "黄緑" },
  { max: 160, name: "緑" },
  { max: 200, name: "青緑" },
  { max: 250, name: "青" },
  { max: 275, name: "青紫" },
  { max: 320, name: "紫" },
  { max: 349, name: "赤紫" },
  { max: 360, name: "赤" },
];

function hueName(h: number): string {
  for (const { max, name } of HUE_NAMES) if (h < max) return name;
  return "赤";
}

/**
 * 系統色名（JIS系統色名に倣う色相×トーンの記述）。
 * 採色した「すべての色」を確定的に言語化できる — 近似ではなく定義による全色対応。
 */
export function systematicName(rgb: RGB): string {
  const { h, s, v } = rgbToHsv(rgb);

  // 無彩（彩度ごく低）— 明度で白〜黒へ。
  if (s < 0.08) {
    if (v >= 0.92) return "白";
    if (v >= 0.72) return "明るい灰色";
    if (v >= 0.45) return "灰色";
    if (v >= 0.22) return "暗い灰色";
    return "黒";
  }

  const hue = hueName(h);
  let tone: string;
  if (s >= 0.65) {
    if (v >= 0.8) tone = "あざやかな";
    else if (v >= 0.5) tone = "濃い";
    else tone = "暗い";
  } else if (s >= 0.35) {
    if (v >= 0.85) tone = "明るい";
    else if (v >= 0.55) tone = "";
    else if (v >= 0.3) tone = "くすんだ";
    else tone = "暗い";
  } else if (s >= 0.15) {
    if (v >= 0.85) tone = "淡い";
    else if (v >= 0.5) tone = "くすんだ";
    else tone = "暗い";
  } else {
    if (v >= 0.85) tone = "ごく淡い";
    else if (v >= 0.5) tone = "灰みの";
    else tone = "暗い灰みの";
  }
  return tone + hue;
}
