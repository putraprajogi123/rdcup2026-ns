/* RD CUP 2026 — logika bersama (publik & panitia) */
(function () {
  const RC = {};
  RC.DEMO = !window.API_URL || /[?&]demo/.test(location.search);
  RC.CACHE_KEY = 'RDCUP26_DATA_V1';

  /* ---------- util ---------- */
  RC.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RC.$ = (q, el) => (el || document).querySelector(q);
  RC.HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  RC.BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  RC.parseDate = s => { const m = String(s || '').match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
  RC.fmtTgl = s => { const d = RC.parseDate(s); return d ? `${RC.HARI[d.getDay()]}, ${d.getDate()} ${RC.BLN[d.getMonth()]} ${d.getFullYear()}` : s; };
  RC.setting = (d, k, def) => { const r = (d.Pengaturan || []).find(x => x.Kunci === k); return r ? r.Nilai : (def || ''); };
  RC.toast = (msg, bad) => {
    let t = RC.$('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2600);
  };

  /* ---------- API ---------- */
  RC.load = async function () {
    if (RC.DEMO) { if (!RC._demo) RC._demo = RC.makeDemo(); return JSON.parse(JSON.stringify(RC._demo)); }
    const r = await fetch(window.API_URL + '?action=data&t=' + Date.now());
    const j = await r.json(); if (!j.ok) throw new Error(j.error);
    try { localStorage.setItem(RC.CACHE_KEY, JSON.stringify(j.data)); } catch (e) {}
    return j.data;
  };
  RC.cached = () => { try { return JSON.parse(localStorage.getItem(RC.CACHE_KEY)); } catch (e) { return null; } };
  RC.post = async function (body) {
    if (RC.DEMO) return RC.mockPost(body);
    const r = await fetch(window.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error);
    try { localStorage.setItem(RC.CACHE_KEY, JSON.stringify(j.data)); } catch (e) {}
    return j;
  };

  /* ---------- Tim / bagan ---------- */
  RC.teamMap = d => { const m = {}; (d.Tim || []).forEach(t => m[t['Kode Cabang'] + '|' + t['Nama Tim']] = t); return m; };
  RC.disp = (d, kode, n) => { if (!n || n === 'BYE') return n; const t = (d.Tim || []).find(x => x['Kode Cabang'] === kode && x['Nama Tim'] === n); return t && !t['Pemain 2'] && t['Pemain 1'] ? t['Pemain 1'] : n; };
  RC.matchesOf = (d, kode) => (d.Pertandingan || []).filter(m => m['Kode Cabang'] === kode)
    .sort((a, b) => (+a.Babak - +b.Babak) || (+a.No - +b.No));
  RC.roundLabel = (r, R) => r === R ? 'Final' : r === R - 1 ? 'Semi Final' : r === R - 2 ? 'Perempat Final' : 'Babak ' + r;

  /* ===== RD_plan: rancangan bagan dari POSISI kocokan manual (sama di Kode.gs & common.js) ===== */
  function RD_plan(kode, teams, stamp) {
    var err = [], slot = {}, max = 0;
    if (teams.length < 2) err.push('Minimal 2 tim/pemain untuk membuat bagan');
    teams.forEach(function (t) {
      if (!String(t.nama || '').trim()) { err.push('Kolom Nama Tim kosong' + (t.ket ? ' untuk: ' + t.ket : '') + ' — isi dulu di tab Tim (untuk single: isi nama pemain)'); return; }
    var raw = String(t.pos == null ? '' : t.pos).trim(), p = Number(raw);
      if (!raw || !(p >= 1) || Math.floor(p) !== p) { err.push('Posisi belum diisi / tidak valid: ' + t.nama); return; }
      if (slot[p]) { err.push('Posisi ' + p + ' dipakai 2 tim: ' + slot[p] + ' dan ' + t.nama); return; }
      slot[p] = t.nama; if (p > max) max = p;
    });
    var size = 2; while (size < Math.max(max, teams.length)) size *= 2;
    if (!err.length) for (var i = 1; i <= size; i += 2)
      if (!slot[i] && !slot[i + 1]) err.push('Posisi ' + i + ' dan ' + (i + 1) + ' sama-sama kosong (BYE lawan BYE). Sebar posisi kosong agar tiap pertandingan minimal ada 1 tim.');
    if (err.length) return { err: err, size: size, matches: [] };
    var R = Math.round(Math.log(size) / Math.LN2), out = [], idx = {};
    for (var r = 1; r <= R; r++) for (var j = 1; j <= size / Math.pow(2, r); j++) {
      var m = { 'ID': kode + '-R' + r + '-M' + j, 'Kode Cabang': kode, 'Babak': String(r), 'No': String(j), 'Tim A': '', 'Tim B': '', 'Skor A': '', 'Skor B': '', 'Pemenang': '', 'Status': 'Belum', 'Lapangan': '', 'Jam': '',
        'Next ID': r < R ? kode + '-R' + (r + 1) + '-M' + Math.ceil(j / 2) : '', 'Next Slot': r < R ? (j % 2 ? 'A' : 'B') : '', 'Diupdate': stamp || '' };
      if (r === 1) {
        m['Tim A'] = slot[2 * j - 1] || 'BYE'; m['Tim B'] = slot[2 * j] || 'BYE';
        if (m['Tim B'] === 'BYE') { m.Status = 'Selesai'; m.Pemenang = m['Tim A']; }
        else if (m['Tim A'] === 'BYE') { m.Status = 'Selesai'; m.Pemenang = m['Tim B']; }
      }
      out.push(m); idx[m.ID] = m;
    }
    out.forEach(function (m) { if (m.Babak === '1' && m.Pemenang && m['Next ID']) idx[m['Next ID']][m['Next Slot'] === 'B' ? 'Tim B' : 'Tim A'] = m.Pemenang; });
    return { err: [], size: size, rounds: R, matches: out };
  }
  
  RC.plan = RD_plan;
  RC.seedOrder = size => { let o = [1]; while (o.length < size) { const n = o.length * 2, nx = []; o.forEach(s => nx.push(s, n + 1 - s)); o = nx; } return o; };
  RC.buildBracket = function (kode, names) { // dipakai mode demo (sama dengan Kode.gs)
    let size = 2; while (size < names.length) size *= 2;
    const R = Math.log2(size), order = RC.seedOrder(size), out = [];
    for (let r = 1; r <= R; r++) for (let i = 1; i <= size / 2 ** r; i++) {
      const m = { ID: `${kode}-R${r}-M${i}`, 'Kode Cabang': kode, Babak: String(r), No: String(i), 'Tim A': '', 'Tim B': '', 'Skor A': '', 'Skor B': '', Pemenang: '', Status: 'Belum', Lapangan: '', Jam: '', 'Next ID': r < R ? `${kode}-R${r + 1}-M${Math.ceil(i / 2)}` : '', 'Next Slot': r < R ? (i % 2 ? 'A' : 'B') : '' };
      if (r === 1) {
        const a = order[(i - 1) * 2], b = order[(i - 1) * 2 + 1];
        m['Tim A'] = a <= names.length ? names[a - 1] : 'BYE'; m['Tim B'] = b <= names.length ? names[b - 1] : 'BYE';
        if (m['Tim B'] === 'BYE') { m.Status = 'Selesai'; m.Pemenang = m['Tim A']; } else if (m['Tim A'] === 'BYE') { m.Status = 'Selesai'; m.Pemenang = m['Tim B']; }
      }
      out.push(m);
    }
    const idx = {}; out.forEach(m => idx[m.ID] = m);
    out.forEach(m => { if (m.Babak === '1' && m.Pemenang && m['Next ID']) idx[m['Next ID']][m['Next Slot'] === 'B' ? 'Tim B' : 'Tim A'] = m.Pemenang; });
    return out;
  };

  /* ---------- Golf S36 ---------- */
  RC.pars = d => { const p = []; (d.Golf_Par || []).forEach(r => p[+r.Hole - 1] = +r.Par || 4); for (let i = 0; i < 18; i++) if (!p[i]) p[i] = 4; return p; };
  RC.golfHoles = function (d, kat) {
    let a = 1, b = 18;
    if (kat === 'Putri') { const m = String(RC.setting(d, 'Golf_Putri_Hole', '1-9')).match(/(\d+)\s*[-–]\s*(\d+)/); a = m ? +m[1] : 1; b = m ? +m[2] : 9; }
    const h = []; for (let i = Math.max(1, a); i <= Math.min(18, b); i++) h.push(i - 1); return h;
  };
  RC.golfCalc = function (row, pars, holes) {
    holes = holes || Array.from({ length: 18 }, (_, i) => i);
    let gross = 0, pts = 0, thru = 0, birdie = 0; const sc = [];
    for (let i = 0; i < 18; i++) { const v = row['H' + (i + 1)]; sc.push(v === '' || v == null ? null : +v); }
    holes.forEach(i => { const s = sc[i]; if (s) { thru++; gross += s; pts += s <= pars[i] ? 2 : s === pars[i] + 1 ? 1 : 0; if (s <= pars[i] - 1) birdie++; } });
    const n = holes.length, done = thru === n, hcp = done ? 2 * n - pts : null, nett = done ? gross - hcp : null;
    return { nama: row.Nama, ou: row.OU, kategori: row.Kategori, row: row._row, sc, holes, n, gross, pts, thru, done, hcp, nett, birdie };
  };
  RC.golfBoard = function (d, kat) {
    const pars = RC.pars(d);
    const list = (d.Golf || []).filter(r => !kat || r.Kategori === kat).map(r => RC.golfCalc(r, pars, RC.golfHoles(d, r.Kategori)));
    list.sort((a, b) => (b.done - a.done) || (a.done ? (a.nett - b.nett) || (a.hcp - b.hcp) : (b.thru - a.thru) || (a.gross - b.gross)));
    let rank = 0; list.forEach((x, i) => { if (x.done) { rank = (i > 0 && list[i - 1].done && list[i - 1].nett === x.nett && list[i - 1].hcp === x.hcp) ? rank : i + 1; x.rank = rank; } });
    return list;
  };

  /* ---------- Karaoke ---------- */
  RC.karaokeBoard = function (d) {
    const nilai = d.Karaoke_Nilai || [];
    return (d.Karaoke || []).map(k => {
      const v = nilai.filter(n => String(n.No) === String(k.No)).map(n => +n.Nilai).filter(x => !isNaN(x));
      return Object.assign({}, k, { jml: v.length, rata: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null });
    });
  };

  /* ---------- Rekap peserta ---------- */
  RC.nameKey = n => String(n || '').normalize('NFKC').replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '').toLowerCase().replace(/[.,'`’]/g, ' ').replace(/\s+/g, ' ').trim();
  RC.shortCab = n => String(n || '').replace('Tenis Lapangan', 'Tenis').replace('Karaoke Ibu & Bapak Staff', 'Karaoke').replace(' Double', '').replace('Pertandingan ', '');
  const ABBR = { hsb: 'hasibuan', nst: 'nasution', mhd: 'm', muhammad: 'm', muhamad: 'm', mohammad: 'm', mohamed: 'm', moh: 'm' };
  RC.toks = n => RC.nameKey(n).split(' ').filter(Boolean).map(t => ABBR[t] || t);
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 1) return 9; const m = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; };
  const tokEq = (s, l) => s === l || (s.length >= 4 && l.length >= 4 && s[0] === l[0] && lev(s, l) <= 1) || (s.length === 1 && l[0] === s);
  const covers = (S, L) => { if (!tokEq(S[0], L[0])) return false; const used = new Set(); return S.every(s => { const i = L.findIndex((l, k) => !used.has(k) && tokEq(s, l)); if (i < 0) return false; used.add(i); return true; }); };
  RC.sameName = function (x, y) {
    let a = RC.toks(x), b = RC.toks(y); const ia = a[0] === 'ibu', ib = b[0] === 'ibu'; if (ia !== ib) return false;
    if (ia) { a = a.slice(1); b = b.slice(1); } if (!a.length || !b.length) return false;
    if (a.length === 1 || b.length === 1) { const s = a.length === 1 ? a : b, l = a.length === 1 ? b : a; return s[0].length >= 4 && s[0] === l[0]; }
    if (a.length === b.length) return covers(a, b) || covers(b, a);
    return a.length < b.length ? covers(a, b) : covers(b, a);
  };
  RC.rekap = function (d) {
    const RP = RC.participants(d); const seen = []; const pan = [];
    (d.Panitia || []).forEach(p => { const n = String(p.Nama || '').trim(); if (!n || seen.some(s => RC.sameName(s, n))) return; seen.push(n);
      const hit = RP.adults.find(a => RC.sameName(a.nama, n) || a.alias.some(x => RC.sameName(x, n))); pan.push({ nama: n, seksi: p.Seksi, peserta: hit || null }); });
    const tambahan = Math.max(0, parseInt(RC.setting(d, 'Tambahan_Konsumsi', '0'), 10) || 0);
    const juga = pan.filter(p => p.peserta).length, bukan = pan.length - juga;
    return { RP, pan, juga, bukan, tambahan, total: RP.adults.length + RP.anak.length + bukan + tambahan };
  };
  RC.participants = function (d) {
    const P = new Map(), cabs = [];
    const cabName = k => { const c = (d.Cabang || []).find(x => x.Kode === k); return c ? RC.shortCab(c.Nama) : k; };
    const merges = [];
    const add = (nama, ou, cab) => {
      nama = String(nama || '').replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '').replace(/\s+/g, ' ').trim(); if (!nama || /mohon pasangan/i.test(nama)) return;
      const k = RC.nameKey(nama); let p = P.get(k);
      if (!p) { for (const q of P.values()) if (RC.sameName(q.nama, nama)) { p = q; break; } }
      if (!p) { p = { nama, ou: ou || '', cab: [], alias: [] }; P.set(k, p); }
      else if (RC.nameKey(p.nama) !== k) { if (!p.alias.includes(nama)) { p.alias.push(nama); merges.push([p.nama, nama]); } if (nama.length > p.nama.length) { p.alias.push(p.nama); p.nama = nama; } P.set(k, p); }
      if (!p.cab.includes(cab)) p.cab.push(cab); if (!p.ou && ou) p.ou = ou;
    };
    const group = {}; const g = (cab, tipe) => { if (!group[cab]) { group[cab] = { cab, tipe, unit: 0, orang: [] }; cabs.push(group[cab]); } return group[cab]; };
    (d.Cabang || []).forEach(c => {
      if (c.Tipe === 'BAGAN') {
        const T = (d.Tim || []).filter(t => t['Kode Cabang'] === c.Kode); const G = g(RC.shortCab(c.Nama), 'tim'); G.unit = T.length;
        T.forEach(t => { const isS = !t['Pemain 2']; G.orang.push({ nama: isS ? t['Pemain 1'] : t['Nama Tim'] + ': ' + t['Pemain 1'] + ' / ' + t['Pemain 2'], ou: t.OU }); [t['Pemain 1'], t['Pemain 2']].forEach(p => add(p, t.OU, RC.shortCab(c.Nama))); });
        if (!isFinite(G.unit)) G.unit = 0; G.single = T.length && T.every(t => !t['Pemain 2']);
      }
    });
    ['Putra', 'Putri'].forEach(k => { const L = (d.Golf || []).filter(r => r.Kategori === k); if (!L.length) return; const G = g('Golf ' + k, 'orang'); G.unit = L.length; L.forEach(r => { G.orang.push({ nama: r.Nama, ou: r.OU }); add(r.Nama, r.OU, 'Golf'); }); });
    const K = d.Karaoke || []; if (K.length) { const G = g('Karaoke', 'penampil'); G.unit = K.length; K.forEach(r => { G.orang.push({ nama: r.Nama + ' (' + r.Kategori + ')', ou: r.OU }); String(r.Nama).split(/\s*&\s*/).forEach(n => add(n, r.OU, 'Karaoke')); }); }
    const A = d.Peserta_Anak || []; if (A.length) { const G = g('Lomba Anak', 'anak'); G.unit = A.length; A.forEach(r => G.orang.push({ nama: r.Nama + ' (' + r.Umur + ' th)', ou: r.OU })); }
    const adults = [...new Set(P.values())].sort((a, b) => a.nama.localeCompare(b.nama));
    const ous = {}; adults.forEach(p => { const o = p.ou || '-'; (ous[o] = ous[o] || { ou: o, dewasa: [], anak: [] }).dewasa.push(p); });
    A.forEach(a => { const o = a.OU || '-'; (ous[o] = ous[o] || { ou: o, dewasa: [], anak: [] }).anak.push(a); });
    return { adults, anak: A, cabs, merges, ous: Object.values(ous).sort((a, b) => (b.dewasa.length + b.anak.length) - (a.dewasa.length + a.anak.length)) };
  };

  /* ---------- Pemenang ---------- */
  RC.winners = function (d, cab) {
    const man = (d.Pemenang_Manual || []).filter(x => x['Kode Cabang'] === cab.Kode);
    if (man.length) return [{ judul: '', list: man.map(x => ({ juara: x.Juara, nama: x.Nama, ou: x.OU })) }];
    const tm = RC.teamMap(d);
    if (cab.Tipe === 'BAGAN') {
      const ms = RC.matchesOf(d, cab.Kode); if (!ms.length) return [];
      const R = Math.max(...ms.map(m => +m.Babak)); const f = ms.find(m => +m.Babak === R);
      if (!f || f.Status !== 'Selesai' || !f.Pemenang) return [];
      const lose = m => m.Pemenang === m['Tim A'] ? m['Tim B'] : m['Tim A'];
      const info = n => { const t = tm[cab.Kode + '|' + n] || {}; return { nama: RC.disp(d, cab.Kode, n), ou: t.OU || '', pemain: [t['Pemain 1'], t['Pemain 2']].filter(Boolean).join(' / ') }; };
      const L = [Object.assign({ juara: '1' }, info(f.Pemenang)), Object.assign({ juara: '2' }, info(lose(f)))];
      ms.filter(m => +m.Babak === R - 1 && m.Status === 'Selesai' && m.Pemenang).forEach(m => { const l = lose(m); if (l && l !== 'BYE') L.push(Object.assign({ juara: '3' }, info(l))); });
      return [{ judul: '', list: L }];
    }
    if (cab.Tipe === 'GOLF') {
      const kat = /putri/i.test(cab.Nama) ? 'Putri' : 'Putra';
      const b = RC.golfBoard(d, kat).filter(x => x.done).slice(0, 3);
      return b.length ? [{ judul: '', list: b.map(x => ({ juara: String(x.rank), nama: x.nama, ou: x.ou, ket: 'Nett ' + x.nett })) }] : [];
    }
    if (cab.Tipe === 'KARAOKE') {
      const all = RC.karaokeBoard(d).filter(x => x.rata != null); const kats = [...new Set(all.map(x => x.Kategori))];
      return kats.map(k => ({ judul: k, list: all.filter(x => x.Kategori === k).sort((a, b) => b.rata - a.rata).slice(0, 3).map((x, i) => ({ juara: String(i + 1), nama: x.Nama, ou: x.OU, ket: x.rata.toFixed(1) })) }));
    }
    if (cab.Tipe === 'ANAK') {
      return (d.Anak || []).filter(a => a['Juara 1']).map(a => ({ judul: a['Kelompok Umur'] + ' — ' + a.Lomba, list: ['1', '2', '3'].map(j => ({ juara: j, nama: a['Juara ' + j] })).filter(x => x.nama) }));
    }
    return [];
  };

  /* ---------- DEMO ---------- */
  RC.makeDemo = function () {
    const OU = ['PLE', 'TLE', 'BME', 'KRE', 'BPE', 'UMWS', 'UMWN', 'TUM', 'CSM', 'RONS', 'PLEE', 'BMEE', 'UMW'];
    const P = ['Andi', 'Budi', 'Citra', 'Dedi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Irwan', 'Joko', 'Kiki', 'Lina', 'Maya', 'Nanda', 'Oki', 'Putri', 'Rina', 'Sari', 'Tono', 'Udin', 'Vina', 'Wati', 'Yudi', 'Zul'];
    const nm = i => P[i % P.length] + ' ' + String.fromCharCode(65 + (i * 7) % 26) + '.';
    const d = {
      Pengaturan: [{ Kunci: 'Nama_Event', Nilai: 'RD CUP 2026' }, { Kunci: 'Sub_Judul', Nilai: 'North Sumatera' }, { Kunci: 'Tagline', Nilai: 'Sportivitas • Kebersamaan • Prestasi' }, { Kunci: 'Mulai_Acara', Nilai: '2026-11-20 13:30' }, { Kunci: 'Juri_Karaoke', Nilai: 'Wahyuri, PTP Silitonga, Ibu Riris, Ibu Iin' }, { Kunci: 'Golf_Putri_Hole', Nilai: '1-9' }],
      Pengumuman: [{ Waktu: '2026-11-06 08:00', Judul: 'Pendaftaran Dibuka', Isi: 'OU agar mengirimkan nama peserta tiap cabang kepada panitia paling lambat 13 Nov 2026.' }, { Waktu: '2026-11-07 07:00', Judul: 'Contoh pengumuman 3', Isi: 'Isi pengumuman contoh.' }, { Waktu: '2026-11-07 08:00', Judul: 'Contoh pengumuman 4', Isi: 'Baris pertama.\nBaris kedua.' }, { Waktu: '2026-11-07 08:30', Judul: 'Contoh pengumuman 5', Isi: 'Isi pengumuman contoh.' }, { Waktu: '2026-11-07 09:00', Judul: 'Technical Meeting', Isi: 'Technical meeting & undian bagan: Senin, 16 Nov 2026 pukul 14:00 di RONS.' }],
      Jadwal: [], Cabang: [], Lokasi: [], Tim: [], Pertandingan: [], Golf_Par: [], Golf: [], Golf_Khusus: [], Karaoke: [], Karaoke_Nilai: [], Peserta_Anak: [], Anak: [], Pemenang_Manual: [], Panitia: []
    };
    const J = [['2026-11-20', '13:30', '14:00', 'Pembukaan RD Cup 2026', 'Club House RONS', ''], ['2026-11-20', '14:00', 'Selesai', 'Tenis Lapangan Putra – Single', 'Tenis RONS', 'TL-PA-S'], ['2026-11-20', '15:30', 'Selesai', 'Tenis Meja Putra – Double', 'Club House RONS', 'TM-PA-D'], ['2026-11-20', '13:30', 'Selesai', 'Golf Putri – S36', 'PGC', 'GOLF-PI'], ['2026-11-20', '19:30', 'Selesai', 'Gaplek', 'Club House RONS', 'GAPLEK'], ['2026-11-21', '08:00', 'Selesai', 'Tenis Lapangan Putra – Double', 'Tenis RONS', 'TL-PA-DA,TL-PA-DB'], ['2026-11-21', '08:00', 'Selesai', 'Tenis Lapangan Putri – Double', 'Tenis TLEE', 'TL-PI-D'], ['2026-11-21', '08:00', 'Selesai', 'Tenis Meja Putri – Double', 'Club House RONS', 'TM-PI-D'], ['2026-11-21', '19:00', 'Selesai', 'Karaoke Ibu & Bapak Staff', 'Club House RONS', 'KARAOKE'], ['2026-11-22', '06:30', 'Selesai', 'Golf Putra – S36', 'PGC', 'GOLF-PA'], ['2026-11-22', '07:00', 'Selesai', 'Pertandingan Anak', 'Club House RONS', 'ANAK'], ['2026-11-22', '12:30', '14:00', 'Penutupan & Penyerahan Hadiah', 'Club House RONS', '']];
    d.Jadwal = J.map(r => ({ Tanggal: r[0], Mulai: r[1], Selesai: r[2], Acara: r[3], Lokasi: r[4], 'Kode Cabang': r[5], Keterangan: '' }));
    const C = [['GOLF-PA', 'Golf Putra', 'Golf', 'GOLF', 'PGC', 'System 36'], ['GOLF-PI', 'Golf Putri', 'Golf', 'GOLF', 'PGC', 'System 36'], ['TL-PA-S', 'Tenis Lapangan Putra Single', 'Tenis Lapangan', 'BAGAN', 'Tenis RONS', 'Gugur'], ['TL-PA-DA', 'Tenis Lapangan Putra Double Kelas A', 'Tenis Lapangan', 'BAGAN', 'Tenis RONS', 'Gugur'], ['TL-PA-DB', 'Tenis Lapangan Putra Double Kelas B', 'Tenis Lapangan', 'BAGAN', 'Tenis RONS', 'Gugur'], ['TL-PI-D', 'Tenis Lapangan Putri Double', 'Tenis Lapangan', 'BAGAN', 'Tenis TLEE', 'Gugur'], ['TM-PA-D', 'Tenis Meja Putra Double', 'Tenis Meja', 'BAGAN', 'Club House RONS', 'Gugur'], ['TM-PI-D', 'Tenis Meja Putri Double', 'Tenis Meja', 'BAGAN', 'Club House RONS', 'Gugur'], ['GAPLEK', 'Gaplek', 'Gaplek', 'BAGAN', 'Club House RONS', 'Gugur'], ['KARAOKE', 'Karaoke Ibu & Bapak Staff', 'Karaoke', 'KARAOKE', 'Club House RONS', 'Penilaian Juri'], ['ANAK', 'Pertandingan Anak', 'Anak', 'ANAK', 'Club House RONS', 'Sesuai umur']];
    const JK = { GOLF: 'Longest – Hole III\nNearest to Line – Hole VI\nNearest to Pin – Hole IX\nBirdie', BAGAN: 'Sistem gugur. Game score 5 (Semi final & final 7).\nWasit dari peserta.', KARAOKE: 'Kategori Pasangan & Individu. Peserta staff PT. TTI.', ANAK: 'Lomba sesuai kelompok umur.' };
    d.Cabang = C.map(r => ({ Kode: r[0], Nama: r[1], Kategori: r[2], Tipe: r[3], Lokasi: r[4], Sistem: r[5], Juknis: r[0] === 'GAPLEK' ? '1 tim = 2 orang. Best of 3, final best of 5.\nDilarang taruhan dalam bentuk apa pun.' : JK[r[3]] }));
    d.Lokasi = [['PGC', 'Perlabian Golf Club'], ['Tenis RONS', 'Lapangan tenis kelas Putra'], ['Tenis TLEE', 'Lapangan tenis kelas Putri'], ['Club House RONS', 'Karaoke, Gaplek, Tenis Meja, Pembukaan & Penutupan']].map(r => ({ Nama: r[0], Keterangan: r[1], 'Link Maps': '' }));
    let k = 0;
    ['TL-PA-S', 'TL-PA-DA', 'TL-PA-DB', 'TL-PI-D', 'TM-PA-D', 'TM-PI-D', 'GAPLEK'].forEach((kode, ci) => {
      const n = [10, 7, 6, 8, 12, 7, 13][ci]; const names = [];
      for (let i = 0; i < n; i++) { const ou = OU[(i + ci) % OU.length]; const single = kode === 'TL-PA-S'; const nama = single ? nm(k) : (OU.filter((x, j) => j < i && OU[(j + ci) % OU.length] === ou).length ? ou + ' 2' : ou); d.Tim.push({ 'Kode Cabang': kode, 'Nama Tim': nama, OU: ou, 'Pemain 1': nm(k), 'Pemain 2': single ? '' : nm(k + 1), Kelas: kode === 'TL-PA-DA' ? 'A' : kode === 'TL-PA-DB' ? 'B' : '', 'Urut Undian': '' }); names.push(nama); k += 2; }
      let size = 2; while (size < n) size *= 2; const ord = RC.seedOrder(size);
      d.Tim.filter(t => t['Kode Cabang'] === kode).forEach((t, i) => t['Urut Undian'] = String(ord.indexOf(i + 1) + 1));
      d.Pertandingan.push(...RC.plan(kode, d.Tim.filter(t => t['Kode Cabang'] === kode).map(t => ({ nama: t['Nama Tim'], pos: t['Urut Undian'] }))).matches);
    });
    d.Golf_Par = [4, 4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 3, 4, 5].map((p, i) => ({ Hole: String(i + 1), Par: String(p) }));
    for (let i = 0; i < 14; i++) { const r = { Kategori: i < 10 ? 'Putra' : 'Putri', Nama: nm(i * 3 + 1), OU: OU[i % OU.length], _row: i + 2 }; for (let h = 1; h <= 18; h++) { const par = +d.Golf_Par[h - 1].Par; r['H' + h] = (i === 3 && h > 12) ? '' : String(par + [0, 1, 1, 2, 0, -1, 1, 3][(i * 5 + h * 3) % 8]); } d.Golf.push(r); }
    d.Golf_Khusus = [['Longest Drive', 'Putra', 'III'], ['Nearest to Line', 'Putra', 'VI'], ['Nearest to Pin', 'Putra', 'IX'], ['Longest Drive', 'Putri', 'III'], ['Nearest to Line', 'Putri', 'VI'], ['Nearest to Pin', 'Putri', 'IX']].map(r => ({ Hadiah: r[0], Kategori: r[1], Hole: r[2], Nama: '', OU: '', Keterangan: '' }));
    for (let i = 1; i <= 8; i++) d.Karaoke.push({ No: String(i), Kategori: i <= 4 ? 'Pasangan' : 'Individu', Nama: i <= 4 ? nm(i) + ' & ' + nm(i + 9) : nm(i + 3), OU: OU[i], Lagu: ['Kemesraan', 'Pelangi di Matamu', 'Bengawan Solo', 'Kisah Kasih di Sekolah', 'Sio Sayang', 'Rayuan Pulau Kelapa', 'Butet', 'Situmorang'][i - 1] });
    d.Peserta_Anak = [['4–6 th','Naufal Shidqi Prianggara','6','PLE','Sony Prianggara'],['7–12 th','Syafiyya Rahma Prianggara','9','PLE','Sony Prianggara'],['4–6 th','Nindya Malika Syah','5','RONS','Oka Riansyah'],['7–12 th','Nuha Ainayya Syah','9','RONS','Oka Riansyah'],['7–12 th','Muhammad Riziq Batubara','7','RONS','Mukti Batubara'],['4–6 th','Abhimanyu','5','TLE','Putra TLE'],['7–12 th','Mayra','12','TLE','Putra TLE'],['13–15 th','Manuel','13','TLE','FHA TLE']].map(r => ({ 'Kelompok Umur': r[0], Nama: r[1], Umur: r[2], OU: r[3], 'Anak Dari': r[4] }));
    d.Anak = [{ 'Kelompok Umur': '4–6 th', Lomba: 'Contoh lomba', 'Juara 1': 'Nindya Malika Syah', 'Juara 2': '', 'Juara 3': '' }];
    d.Panitia = [['Penasehat','Penasehat','M. Nasir'],['Ketua','Ketua I','Putra Prajogi','081200000000'],['Ketua','Ketua II','Ridwan S Siagian'],['Bendahara','Bendahara','Iqbal Syahputra'],['Golf','Koordinator Golf','Sonny Prianggara','081200000001'],['Golf','Anggota','Firdaus Simorangkir'],['Tenis Lapangan','Koordinator Tenis Lapangan','Noveryanda'],['Tenis Lapangan','Anggota','Roma Dhoni']].map(r => ({ Seksi: r[0], Jabatan: r[1], Nama: r[2], 'No WA': r[3] || '' }));
    // contoh beberapa hasil
    const sv = (id, a, b) => RC.mockPost({ action: 'saveMatch', id, skorA: a, skorB: b }, d);
    RC.matchesOf(d, 'TL-PA-S').filter(m => m.Babak === '1' && m.Status !== 'Selesai').forEach((m, i) => sv(m.ID, i % 2 ? 3 : 5, i % 2 ? 5 : 2));
    const ms = RC.matchesOf(d, 'TM-PA-D').filter(m => m.Babak === '1' && m.Status !== 'Selesai'); if (ms[0]) sv(ms[0].ID, 2, 1); if (ms[1]) { ms[1]['Skor A'] = '1'; ms[1]['Skor B'] = '1'; ms[1].Status = 'Berlangsung'; }
    for (let r = 1; r <= 4; r++) RC.matchesOf(d, 'GAPLEK').filter(m => +m.Babak === r && m.Status !== 'Selesai' && m['Tim A'] && m['Tim B']).forEach((m, i) => sv(m.ID, i % 2 ? 1 : 2, i % 2 ? 2 : 0));
    d.Karaoke_Nilai = [['1', 'Wahyuri', 82], ['1', 'Ibu Riris', 85], ['2', 'Wahyuri', 78], ['5', 'Ibu Iin', 88]].map(r => ({ No: r[0], Juri: r[1], Nilai: String(r[2]) }));
    d._time = 'demo';
    return d;
  };

  RC.mockPost = function (p, data) {
    const d = data || RC._demo || (RC._demo = RC.makeDemo());
    const res = (r) => ({ ok: true, result: r, data: JSON.parse(JSON.stringify(d)) });
    if (p.action === 'login') { const role = { '201126': 'admin', '2026': 'panitia', '1919': 'juri' }[p.pin]; if (!role) throw new Error('PIN salah'); return res({ role, juri: RC.setting(d, 'Juri_Karaoke') }); }
    if (p.action === 'saveMatch') {
      const m = d.Pertandingan.find(x => x.ID === p.id); const a = p.skorA === '' ? '' : +p.skorA, b = p.skorB === '' ? '' : +p.skorB;
      m['Skor A'] = String(a); m['Skor B'] = String(b); if (p.lapangan != null) m.Lapangan = p.lapangan; if (p.jam != null) m.Jam = p.jam;
      let w = p.pemenang === 'A' || p.pemenang === 'B' ? p.pemenang : (a !== '' && b !== '' && a !== b ? (a > b ? 'A' : 'B') : '');
      const st = p.status || (w ? 'Selesai' : (a !== '' || b !== '' ? 'Berlangsung' : 'Belum')); const wn = w ? m['Tim ' + w] : '';
      const nx = d.Pertandingan.find(x => x.ID === m['Next ID']); const oldW = m.Status === 'Selesai' ? m.Pemenang : '', newW = st === 'Selesai' ? wn : '';
      if (!data && nx && oldW !== newW && nx.Status !== 'Belum') throw new Error('Tidak bisa mengubah pemenang: pertandingan babak berikutnya #' + nx.No + ' sudah ' + nx.Status.toLowerCase() + '. Reset dulu pertandingan itu.');
      m.Pemenang = st === 'Selesai' ? wn : ''; m.Status = st;
      if (m['Next ID']) { const n = d.Pertandingan.find(x => x.ID === m['Next ID']); n[m['Next Slot'] === 'B' ? 'Tim B' : 'Tim A'] = st === 'Selesai' ? wn : ''; }
      return res({ id: p.id });
    }
    const R1lock = m => { if (m.Babak !== '1') return 'Hanya babak 1'; const bye = m['Tim A'] === 'BYE' || m['Tim B'] === 'BYE'; if (!bye && m.Status !== 'Belum') return 'Pertandingan #' + m.No + ' sudah ' + m.Status.toLowerCase() + ' — reset dulu skornya'; const n = d.Pertandingan.find(x => x.ID === m['Next ID']); if (n && n.Status !== 'Belum') return 'Babak berikutnya sudah ' + n.Status.toLowerCase(); return ''; };
    const R1fix = m => { let st = 'Belum', w = ''; if (m['Tim B'] === 'BYE') { st = 'Selesai'; w = m['Tim A']; } else if (m['Tim A'] === 'BYE') { st = 'Selesai'; w = m['Tim B']; } Object.assign(m, { 'Skor A': '', 'Skor B': '', Pemenang: w, Status: st }); const n = d.Pertandingan.find(x => x.ID === m['Next ID']); if (n) n[m['Next Slot'] === 'B' ? 'Tim B' : 'Tim A'] = w; };
    const pos = (m, sl) => (+m.No - 1) * 2 + (sl === 'A' ? 1 : 2);
    const setPos = (kode, nm, v) => { const t = d.Tim.find(x => x['Kode Cabang'] === kode && x['Nama Tim'] === nm); if (t) t['Urut Undian'] = String(v); };
    if (p.action === 'swapSlots') {
      const ma = d.Pertandingan.find(x => x.ID === p.a.id), mb = d.Pertandingan.find(x => x.ID === p.b.id); const e = R1lock(ma) || R1lock(mb); if (e) throw new Error(e);
      const ka = 'Tim ' + p.a.slot, kb = 'Tim ' + p.b.slot, na = ma[ka], nb = mb[kb]; const A2 = Object.assign({}, ma), B2 = ma === mb ? A2 : Object.assign({}, mb); A2[ka] = nb; B2[kb] = na;
      if ([A2, B2].some(m => m['Tim A'] === 'BYE' && m['Tim B'] === 'BYE')) throw new Error('Penukaran ini membuat BYE lawan BYE — pilih posisi lain');
      ma[ka] = nb; mb[kb] = na; R1fix(ma); if (mb !== ma) R1fix(mb); setPos(ma['Kode Cabang'], nb, pos(ma, p.a.slot)); setPos(ma['Kode Cabang'], na, pos(mb, p.b.slot)); return res({});
    }
    if (p.action === 'setSlot') {
      const m = d.Pertandingan.find(x => x.ID === p.id); const e = R1lock(m); if (e) throw new Error(e); const key = 'Tim ' + p.slot, lama = m[key], baru = p.tim || 'BYE';
      if (baru !== 'BYE' && d.Pertandingan.some(x => x['Kode Cabang'] === m['Kode Cabang'] && x.Babak === '1' && (x['Tim A'] === baru || x['Tim B'] === baru))) throw new Error(baru + ' sudah ada di bagan — gunakan Tukar posisi');
      const t2 = Object.assign({}, m, { [key]: baru }); if (t2['Tim A'] === 'BYE' && t2['Tim B'] === 'BYE') throw new Error('Tidak boleh BYE lawan BYE — posisi lawannya sudah BYE');
      m[key] = baru; R1fix(m); setPos(m['Kode Cabang'], lama, ''); setPos(m['Kode Cabang'], baru, pos(m, p.slot)); return res({});
    }
    if (p.action === 'editTim') { const t = d.Tim.find(x => x['Kode Cabang'] === p.kode && x['Nama Tim'] === p.nama); Object.assign(t, { 'Pemain 1': p.p1, 'Pemain 2': p.p2, OU: p.ou, Kelas: p.kelas }); return res({}); }
    if (p.action === 'generateBracket') {
      const ts = d.Tim.filter(t => t['Kode Cabang'] === p.kode); if (p.posisi) ts.forEach(t => { if (p.posisi[t['Nama Tim']] != null) t['Urut Undian'] = String(p.posisi[t['Nama Tim']]); });
      const pl = RC.plan(p.kode, ts.map(t => ({ nama: t['Nama Tim'], pos: t['Urut Undian'] }))); if (pl.err.length) throw new Error('Bagan belum bisa dibuat:\n• ' + pl.err.join('\n• '));
      const cab = d.Cabang.find(c => c.Kode === p.kode); const played = d.Pertandingan.filter(m => m['Kode Cabang'] === p.kode && m.Status !== 'Belum' && m['Tim A'] !== 'BYE' && m['Tim B'] !== 'BYE');
      if (played.length && String(p.konfirmasi || '').trim().toLowerCase() !== cab.Nama.toLowerCase()) throw new Error('Sudah ada ' + played.length + ' pertandingan berskor. Untuk membuat ulang, ketik nama cabang persis: ' + cab.Nama);
      d.Pertandingan = d.Pertandingan.filter(m => m['Kode Cabang'] !== p.kode).concat(pl.matches); return res({});
    }
    if (p.action === 'saveGolf') { let r = d.Golf.find(x => x._row === +p.row); if (!r) { r = { Kategori: p.kategori, Nama: p.nama, OU: p.ou, _row: d.Golf.length + 2 }; d.Golf.push(r); } p.scores.forEach((v, i) => r['H' + (i + 1)] = v === '' ? '' : String(v)); return res({ row: r._row }); }
    if (p.action === 'saveKaraoke') { const e = d.Karaoke_Nilai.find(x => x.No === String(p.no) && x.Juri === p.juri); if (e) e.Nilai = String(p.nilai); else d.Karaoke_Nilai.push({ No: String(p.no), Juri: p.juri, Nilai: String(p.nilai) }); return res({}); }
    if (p.action === 'addPengumuman') { d.Pengumuman.push({ Waktu: new Date().toISOString().slice(0, 16).replace('T', ' '), Judul: p.judul, Isi: p.isi }); return res({}); }
    throw new Error('Fungsi tidak dikenal');
  };

  /* ---------- Tema terang/gelap ---------- */
  RC.autoTheme = () => { const d = new Date(), h = d.getHours() + d.getMinutes() / 60; return (h >= 5.5 && h < 18) ? 'light' : 'dark'; };
  RC.pref = () => { try { return localStorage.getItem('RD_THEME') || 'auto'; } catch (e) { return 'auto'; } };
  RC.applyTheme = function () {
    const p = RC.pref(), t = p === 'auto' ? RC.autoTheme() : p;
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'light' ? '#0b5c43' : '#063d2e';
    const b = document.getElementById('thbtn'); if (b) b.textContent = p === 'auto' ? (t === 'light' ? '☀️ Auto' : '🌙 Auto') : (p === 'light' ? '☀️ Terang' : '🌙 Gelap');
  };
  RC.cycleTheme = function () {
    const nx = { auto: 'light', light: 'dark', dark: 'auto' }[RC.pref()] || 'auto';
    try { nx === 'auto' ? localStorage.removeItem('RD_THEME') : localStorage.setItem('RD_THEME', nx); } catch (e) {}
    RC.applyTheme(); RC.toast(nx === 'auto' ? 'Tema otomatis (terang siang, gelap malam)' : nx === 'light' ? 'Tema terang' : 'Tema gelap');
  };
  document.addEventListener('DOMContentLoaded', RC.applyTheme);
  if (document.readyState !== 'loading') setTimeout(RC.applyTheme, 0);
  setInterval(() => { if (RC.pref() === 'auto') RC.applyTheme(); }, 60000);

  window.RC = RC;
})();
