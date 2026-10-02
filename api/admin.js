// Espace propriétaire : toute modification passe par ici et exige le mot de passe.
// Le mot de passe n'est PAS écrit dans le code : il est dans Vercel (ADMIN_PASSWORD).
import { put } from '@vercel/blob';
import crypto from 'node:crypto';

const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const httpsUrl = (u) => typeof u === 'string' && /^https:\/\//.test(u) && u.length < 600;
const txt = (s, n) => String(s == null ? '' : s).slice(0, n);

// On ne garde que des données propres et de taille limitée.
function clean(d) {
  d = d && typeof d === 'object' ? d : {};
  const services = {};
  if (d.services && typeof d.services === 'object') {
    for (const [k, v] of Object.entries(d.services).slice(0, 40)) {
      if (/^[\w.-]{1,40}$/.test(k) && httpsUrl(v)) services[k] = v;
    }
  }
  const cats = (Array.isArray(d.cats) ? d.cats : []).slice(0, 20).map((c) => txt(c, 30)).filter(Boolean);
  const works = (Array.isArray(d.works) ? d.works : []).slice(0, 300).map((w) => {
    if (!w || typeof w !== 'object') return null;
    const o = {
      id: Number(w.id) || Date.now(),
      type: w.type === 'video' ? 'video' : 'photo',
      cat: txt(w.cat, 30),
      titre: txt(w.titre, 80),
      desc: txt(w.desc, 200),
    };
    if (httpsUrl(w.url)) o.url = w.url;
    if (httpsUrl(w.link)) o.link = w.link;
    return o;
  }).filter(Boolean);
  const tems = (Array.isArray(d.tems) ? d.tems : []).slice(0, 100).map((t) => ({
    nom: txt(t && t.nom, 60),
    role: txt(t && t.role, 60),
    note: Math.max(1, Math.min(5, parseInt(t && t.note, 10) || 5)),
    texte: txt(t && t.texte, 400),
  })).filter((t) => t.nom && t.texte);
  return { services, cats, works, tems };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Serveur non configuré (mot de passe ou stockage manquant)' });
  }
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (!same(b.password || '', pw)) {
    await new Promise((r) => setTimeout(r, 800)); // ralentit les essais au hasard
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  try {
    if (b.action === 'login') return res.status(200).json({ ok: true });

    if (b.action === 'save') {
      await put('site-data.json', JSON.stringify(clean(b.data)), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'upload') {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
      if (!m) return res.status(400).json({ error: 'Image non valide' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 3500000) return res.status(413).json({ error: 'Image trop lourde' });
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const name = 'img/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
      const r = await put(name, buf, { access: 'public', addRandomSuffix: false, contentType: 'image/' + m[1] });
      return res.status(200).json({ url: r.url });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur du serveur' });
  }
}
