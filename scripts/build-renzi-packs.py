# 生成「读懂经典」系列数据 renzi-packs.js
# 输入: scratchpad/texts/*.txt (殆知阁语料, 简体) + tangshi300.json (繁体, 转简)
# 每个系列: 按该书字频降序, 语境词取书内最高频二字组合, 拼音用 pypinyin
# 运行: fontenv/bin/python scripts/build-renzi-packs.py <texts_dir> <output_js> <output_charlist>
import json, re, sys, unicodedata
from collections import Counter
from pypinyin import pinyin, Style
from opencc import OpenCC

t2s = OpenCC('t2s')
CJK = re.compile(r'[一-鿿]+')
COVER_TARGET = 0.995   # 收录到累计覆盖 99.5%
CHAR_CAP = 2000        # 每系列至多 2000 字

REPO = '/Users/dou/创业/项目/chinese'

def runs_of(text):
    return CJK.findall(text)

def analyze(texts):
    chars, bigrams = Counter(), Counter()
    for text in texts:
        for run in runs_of(text):
            chars.update(run)
            bigrams.update(run[i:i+2] for i in range(len(run) - 1))
    return chars, bigrams

def build_pack(pid, title, emoji, desc, texts, group=''):
    chars, bigrams = analyze(texts)
    total = sum(chars.values())
    # 每个字挑书内最高频的二字搭配作语境词
    best_word = {}
    for bg, n in bigrams.items():
        for ch in bg:
            if n > best_word.get(ch, ('', 0))[1]:
                best_word[ch] = (bg, n)
    kept, cum = [], 0
    for ch, n in chars.most_common():
        if cum / total >= COVER_TARGET or len(kept) >= CHAR_CAP:
            break
        cum += n
        py = pinyin(ch, style=Style.TONE)[0][0]
        word = best_word.get(ch, (ch, 0))[0]
        kept.append([ch, py, word, n])
    print(f'{title}: 全文 {total} 字, 独立字 {len(chars)}, 收录 {len(kept)} 字 (覆盖 {cum/total*100:.1f}%)')
    return { 'id': pid, 'title': title, 'emoji': emoji, 'group': group, 'desc': desc,
             'total': total, 'chars': kept }

def main():
    tdir, out_js, out_chars = sys.argv[1], sys.argv[2], sys.argv[3]
    read = lambda name: open(f'{tdir}/{name}', encoding='utf-8').read()

    tangshi = json.load(open(f'{REPO}/tangshi300.json', encoding='utf-8'))
    tangshi_text = t2s.convert(''.join(''.join(p['paragraphs']) + p['title'] for p in tangshi))
    shijing = json.load(open(f'{tdir}/shijing.json', encoding='utf-8'))
    shijing_text = t2s.convert(''.join(''.join(p['content']) + p['title'] for p in shijing))

    G_MENG, G_JING, G_SHI, G_ZHU, G_ZHOU = '蒙学启蒙', '诸子经典', '诗歌之美', '传世名著', '静心经咒'
    packs = [
        build_pack('sanzijing', '三字经', '🧒', '能认这些字，就能读懂三字经', [read('sanzijing.txt')], G_MENG),
        build_pack('qianziwen', '千字文', '📝', '一千个不重复的字，古人的识字第一课', [read('qianziwen.txt')], G_MENG),
        build_pack('dizigui', '弟子规', '🎎', '能认这些字，就能读懂弟子规', [read('dizigui.txt')], G_MENG),
        build_pack('shenglv', '声律启蒙', '🎵', '云对雨，雪对风——对出汉语的韵律', [read('shenglv.txt')], G_MENG),
        build_pack('liweng', '笠翁对韵', '🎐', '天对地，雨对风——李渔教你对对子', [read('liweng.txt')], G_MENG),
        build_pack('zengguang', '增广贤文', '🧠', '能认这些字，就能读懂增广贤文的处世智慧', [read('zengguang.txt')], G_MENG),
        build_pack('youxue', '幼学琼林', '🏮', '中国古代的百科启蒙书', [read('youxue.txt')], G_MENG),
        build_pack('lunyu', '论语', '📜', '能认这些字，就能读懂论语', [read('lunyu.txt')], G_JING),
        build_pack('daodejing', '道德经', '☯️', '能认这些字，就能读懂道德经', [read('daodejing.txt')], G_JING),
        build_pack('zhuangzi', '庄子', '🦋', '能认这些字，就能读懂庄子的逍遥世界', [read('zhuangzi.txt')], G_JING),
        build_pack('zhouyi', '易经', '🌓', '能认这些字，就能读懂易经', [read('zhouyi.txt')], G_JING),
        build_pack('sunzi', '孙子兵法', '🛡️', '能认这些字，就能读懂孙子兵法', [read('sunzi.txt')], G_JING),
        build_pack('neijing', '黄帝内经', '🌿', '能认这些字，就能读懂黄帝内经', [read('suwen2.txt'), read('lingshu.txt')], G_JING),
        build_pack('tangshi', '唐诗三百首', '🌙', '能认这些字，就能读懂唐诗三百首', [tangshi_text], G_SHI),
        build_pack('songci', '宋词三百首', '🌊', '能认这些字，就能读懂宋词三百首', [read('songci.txt')], G_SHI),
        build_pack('shijing', '诗经', '🦌', '能认这些字，就能读懂诗经', [shijing_text], G_SHI),
        build_pack('xiyou', '西游记', '🐒', '能认这些字，就能读懂西游记', [read('xiyouji.txt')], G_ZHU),
        build_pack('sanguo', '三国演义', '🐎', '能认这些字，就能读懂三国演义', [read('sanguo.txt')], G_ZHU),
        build_pack('shuihu', '水浒传', '🐯', '能认这些字，就能读懂水浒传', [read('shuihuzhuan.txt')], G_ZHU),
        build_pack('honglou', '红楼梦', '🌸', '能认这些字，就能读懂红楼梦', [read('hongloumeng.txt')], G_ZHU),
        build_pack('shanhai', '山海经', '🐉', '能认这些字，就能读懂山海经的奇兽世界', [read('shanhai.txt')], G_ZHU),
        build_pack('shiji', '史记', '🏛️', '能认这些字，就能读懂史记', [read('shiji.txt')], G_ZHU),
        build_pack('liaozhai', '聊斋志异', '👻', '能认这些字，就能读懂聊斋的狐仙鬼怪', [read('liaozhai.txt')], G_ZHU),
        build_pack('xinjing', '心经', '🪷', '二百六十个字的般若智慧', [read('xinjing.txt')], G_ZHOU),
        build_pack('badashenzhou', '八大神咒', '🌟', '道门八大神咒，金光护体', [read('badashenzhou.txt')], G_ZHOU),
    ]

    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('/* 读懂经典系列 · 自动生成 (scripts/build-renzi-packs.py)\n')
        f.write('   字按书内频次降序; 语境词取书内最高频二字搭配; total=全书总字数 */\n')
        f.write('window.RENZI_PACKS=')
        json.dump(packs, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # 字体子集用: 全部系列字 + 分级字库
    union = set()
    for p in packs:
        union.update(c[0] for c in p['chars'])
        union.update(ch for c in p['chars'] for ch in c[2])
    band_src = open(f'{REPO}/renzi-data.js', encoding='utf-8').read()
    union.update(CJK.findall(band_src) and ''.join(CJK.findall(band_src)))
    with open(out_chars, 'w', encoding='utf-8') as f:
        f.write(''.join(sorted(union)))
    print(f'字体子集字符数: {len(union)}')

if __name__ == '__main__':
    main()
