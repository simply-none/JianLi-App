/**
 * 天气搜索城市映射数据
 * 数据层级：
 * - capital：省会 / 自治区首府 / 直辖市（全国 31 个）
 * - prefecture：地级市 / 地区 / 州 / 盟（全国全量）
 * - county：县级城市 / 城区（目前覆盖 江西省、广东省 全量，其余省份可按需扩展）
 *
 * 用途：搜索建议（输入关键字匹配城市名或省份简称）；
 * 查询词统一使用「城市名+天气」（如「南康天气」「于都天气」），县级城市自动去「区/县/市」后缀取短名。
 */

/** 城市条目 */
export interface CityEntry {
  /** 城市名（如「南昌」「于都县」） */
  name: string
  /** 所属省份全名（如「江西省」） */
  province: string
  /** 层级：capital=省会/直辖市，prefecture=地级市，county=县级/城区 */
  level: 'capital' | 'prefecture' | 'county'
  /** 实际查询词：城市名（县级取去后缀的短名，如「南康」「于都」） */
  searchName: string
}

/**
 * 去除城市名末尾的行政区划后缀，得到搜索用短名
 * @param name 城市全名（如「于都县」「南康区」「乳源瑶族自治县」）
 * @returns 短名（如「于都」「南康」「乳源」）；去后缀后过短（如「城区」）时返回原名
 */
function shortCityName(name: string): string {
  const short = name.replace(/(自治县|自治旗|矿区|林区|新区|区|县|市)$/, '')
  return short.length >= 2 ? short : name
}

/** 省份分组原始数据（用于展开成扁平条目） */
interface ProvinceGroup {
  /** 省份全名 */
  province: string
  /** 省份简称（拼县级查询词用） */
  short: string
  /** 省会（或首府、直辖市名） */
  capital: string
  /** 地级市/州/盟/地区列表 */
  prefectures: string[]
  /** 县级映射：地级市名 → 县级城市/城区列表（可选，目前仅江西/广东全量） */
  counties?: Record<string, string[]>
}

/** 全国省份分组数据（ prefectures 第一个元素即省会的不在此处理，省会单独字段） */
const PROVINCE_GROUPS: ProvinceGroup[] = [
  {
    province: '北京市', short: '北京', capital: '北京', prefectures: [],
  },
  {
    province: '上海市', short: '上海', capital: '上海', prefectures: [],
  },
  {
    province: '天津市', short: '天津', capital: '天津', prefectures: [],
  },
  {
    province: '重庆市', short: '重庆', capital: '重庆', prefectures: [],
  },
  {
    province: '河北省', short: '河北', capital: '石家庄',
    prefectures: ['唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'],
  },
  {
    province: '山西省', short: '山西', capital: '太原',
    prefectures: ['大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'],
  },
  {
    province: '内蒙古自治区', short: '内蒙古', capital: '呼和浩特',
    prefectures: ['包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
  },
  {
    province: '辽宁省', short: '辽宁', capital: '沈阳',
    prefectures: ['大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'],
  },
  {
    province: '吉林省', short: '吉林', capital: '长春',
    prefectures: ['吉林', '四平', '辽源', '通化', '白山', '松原', '白城', '延边州'],
  },
  {
    province: '黑龙江省', short: '黑龙江', capital: '哈尔滨',
    prefectures: ['齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化', '大兴安岭地区'],
  },
  {
    province: '江苏省', short: '江苏', capital: '南京',
    prefectures: ['无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁'],
  },
  {
    province: '浙江省', short: '浙江', capital: '杭州',
    prefectures: ['宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'],
  },
  {
    province: '安徽省', short: '安徽', capital: '合肥',
    prefectures: ['芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'],
  },
  {
    province: '福建省', short: '福建', capital: '福州',
    prefectures: ['厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'],
  },
  {
    province: '江西省', short: '江西', capital: '南昌',
    prefectures: ['景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'],
    counties: {
      南昌: ['东湖区', '西湖区', '青云谱区', '青山湖区', '新建区', '红谷滩区', '南昌县', '安义县', '进贤县'],
      景德镇: ['昌江区', '珠山区', '乐平市', '浮梁县'],
      萍乡: ['安源区', '湘东区', '莲花县', '上栗县', '芦溪县'],
      九江: ['濂溪区', '浔阳区', '柴桑区', '瑞昌市', '共青城市', '庐山市', '武宁县', '修水县', '永修县', '德安县', '都昌县', '湖口县', '彭泽县'],
      新余: ['渝水区', '分宜县'],
      鹰潭: ['月湖区', '余江区', '贵溪市'],
      赣州: ['章贡区', '南康区', '赣县区', '瑞金市', '龙南市', '信丰县', '大余县', '上犹县', '崇义县', '安远县', '定南县', '全南县', '宁都县', '于都县', '兴国县', '会昌县', '寻乌县', '石城县'],
      吉安: ['吉州区', '青原区', '井冈山市', '吉安县', '吉水县', '峡江县', '新干县', '永丰县', '泰和县', '遂川县', '万安县', '安福县', '永新县'],
      宜春: ['袁州区', '丰城市', '樟树市', '高安市', '奉新县', '万载县', '上高县', '宜丰县', '靖安县', '铜鼓县'],
      抚州: ['临川区', '东乡区', '南城县', '黎川县', '南丰县', '崇仁县', '乐安县', '宜黄县', '金溪县', '资溪县', '广昌县'],
      上饶: ['信州区', '广丰区', '广信区', '德兴市', '玉山县', '铅山县', '横峰县', '弋阳县', '余干县', '鄱阳县', '万年县', '婺源县'],
    },
  },
  {
    province: '山东省', short: '山东', capital: '济南',
    prefectures: ['青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'],
  },
  {
    province: '河南省', short: '河南', capital: '郑州',
    prefectures: ['开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'],
    counties: {
      省直辖: ['济源市'],
    },
  },
  {
    province: '湖北省', short: '湖北', capital: '武汉',
    prefectures: ['黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州', '恩施州'],
    counties: {
      省直辖: ['仙桃市', '潜江市', '天门市', '神农架林区'],
    },
  },
  {
    province: '湖南省', short: '湖南', capital: '长沙',
    prefectures: ['株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西州'],
  },
  {
    province: '广东省', short: '广东', capital: '广州',
    prefectures: ['韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮'],
    counties: {
      广州: ['荔湾区', '越秀区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
      韶关: ['武江区', '浈江区', '曲江区', '乐昌市', '南雄市', '始兴县', '仁化县', '翁源县', '乳源瑶族自治县', '新丰县'],
      深圳: ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区'],
      珠海: ['香洲区', '斗门区', '金湾区'],
      汕头: ['龙湖区', '金平区', '濠江区', '澄海区', '潮阳区', '潮南区', '南澳县'],
      佛山: ['禅城区', '南海区', '顺德区', '三水区', '高明区'],
      江门: ['蓬江区', '江海区', '新会区', '台山市', '开平市', '鹤山市', '恩平市'],
      湛江: ['赤坎区', '霞山区', '坡头区', '麻章区', '廉江市', '雷州市', '吴川市', '遂溪县', '徐闻县'],
      茂名: ['茂南区', '电白区', '高州市', '化州市', '信宜市'],
      肇庆: ['端州区', '鼎湖区', '高要区', '四会市', '广宁县', '德庆县', '封开县', '怀集县'],
      惠州: ['惠城区', '惠阳区', '惠东县', '博罗县', '龙门县'],
      梅州: ['梅江区', '梅县区', '兴宁市', '平远县', '蕉岭县', '大埔县', '丰顺县', '五华县'],
      汕尾: ['城区', '海丰县', '陆丰市', '陆河县'],
      河源: ['源城区', '和平县', '龙川县', '紫金县', '连平县', '东源县'],
      阳江: ['江城区', '阳东区', '阳春市', '阳西县'],
      清远: ['清城区', '清新区', '英德市', '连州市', '佛冈县', '阳山县', '连山壮族瑶族自治县', '连南瑶族自治县'],
      潮州: ['湘桥区', '潮安区', '饶平县'],
      揭阳: ['榕城区', '揭东区', '普宁市', '揭西县', '惠来县'],
      云浮: ['云城区', '云安区', '罗定市', '新兴县', '郁南县'],
    },
  },
  {
    province: '广西壮族自治区', short: '广西', capital: '南宁',
    prefectures: ['柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'],
  },
  {
    province: '海南省', short: '海南', capital: '海口',
    prefectures: ['三亚', '三沙', '儋州'],
  },
  {
    province: '四川省', short: '四川', capital: '成都',
    prefectures: ['自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳', '阿坝州', '甘孜州', '凉山州'],
  },
  {
    province: '贵州省', short: '贵州', capital: '贵阳',
    prefectures: ['六盘水', '遵义', '安顺', '毕节', '铜仁', '黔西南州', '黔东南州', '黔南州'],
  },
  {
    province: '云南省', short: '云南', capital: '昆明',
    prefectures: ['曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧', '楚雄州', '红河州', '文山州', '西双版纳州', '大理州', '德宏州', '怒江州', '迪庆州'],
  },
  {
    province: '西藏自治区', short: '西藏', capital: '拉萨',
    prefectures: ['日喀则', '昌都', '林芝', '山南', '那曲', '阿里地区'],
  },
  {
    province: '陕西省', short: '陕西', capital: '西安',
    prefectures: ['铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'],
  },
  {
    province: '甘肃省', short: '甘肃', capital: '兰州',
    prefectures: ['嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南', '临夏州', '甘南州'],
  },
  {
    province: '青海省', short: '青海', capital: '西宁',
    prefectures: ['海东', '海北州', '黄南州', '海南州', '果洛州', '玉树州', '海西州'],
  },
  {
    province: '宁夏回族自治区', short: '宁夏', capital: '银川',
    prefectures: ['石嘴山', '吴忠', '固原', '中卫'],
  },
  {
    province: '新疆维吾尔自治区', short: '新疆', capital: '乌鲁木齐',
    prefectures: ['克拉玛依', '吐鲁番', '哈密', '昌吉州', '博尔塔拉州', '巴音郭楞州', '阿克苏地区', '克孜勒苏州', '喀什地区', '和田地区', '伊犁州', '塔城地区', '阿勒泰地区'],
  },
]

/** 展开后的全量城市条目（模块加载时生成一次） */
export const CITY_ENTRIES: CityEntry[] = PROVINCE_GROUPS.flatMap((group) => {
  const entries: CityEntry[] = [
    { name: group.capital, province: group.province, level: 'capital', searchName: group.capital },
  ]
  for (const city of group.prefectures) {
    entries.push({ name: city, province: group.province, level: 'prefecture', searchName: city })
  }
  // 县级条目：查询词使用去后缀短名（如「南康」「于都」），天气链路统一按「城市名+天气」搜索
  const counties = group.counties || {}
  for (const list of Object.values(counties)) {
    for (const county of list) {
      entries.push({
        name: county,
        province: group.province,
        level: 'county',
        searchName: shortCityName(county),
      })
    }
  }
  return entries
})

/** 省会/直辖市条目列表（输入为空时的默认建议） */
export const CAPITAL_ENTRIES: CityEntry[] = CITY_ENTRIES.filter((e) => e.level === 'capital')

/**
 * 按关键字搜索城市条目
 * @param keyword 关键字（可为空；为空时返回省会列表）
 * @param limit 返回条数上限，默认 20
 * @returns 匹配的城市条目列表（县级 → 地级 → 省会的优先级内按名称匹配）
 */
export function searchCityEntries(keyword: string, limit = 20): CityEntry[] {
  const key = keyword.trim()
  if (!key) {
    return CAPITAL_ENTRIES.slice(0, limit)
  }
  // 关键字命中城市名或省份简称
  const matched = CITY_ENTRIES.filter(
    (e) => e.name.includes(key) || e.province.includes(key) || e.searchName.includes(key)
  )
  // 层级排序：地级/省会优先展示，县级其次
  const levelOrder: Record<CityEntry['level'], number> = { capital: 0, prefecture: 0, county: 1 }
  matched.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || a.name.length - b.name.length)
  return matched.slice(0, limit)
}

/** 层级中文标签（建议项展示用） */
export const CITY_LEVEL_LABEL: Record<CityEntry['level'], string> = {
  capital: '省会',
  prefecture: '地级市',
  county: '县级',
}
