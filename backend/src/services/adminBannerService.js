const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const REVISION_KEY = 'ADMIN_BANNERS_REVISION';
const BUILTIN_ID = 'builtin-banner-principal';
const BUILTIN_IMAGE = 'builtin:banner-principal';
const MAX_BANNERS = 4;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PIXELS = 30_000_000;

function parseImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 24 && buffer.toString('hex', 0, 8) === '89504e470d0a1a0a') {
    return { format: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buffer.toString('ascii', 12, 16);
    if (kind === 'VP8X' && buffer.length >= 30) return {
      format: 'image/webp', width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3)
    };
    if (kind === 'VP8 ' && buffer.length >= 30) return {
      format: 'image/webp', width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff
    };
    if (kind === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { format: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { format: 'image/jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += length + 2;
    }
  }
  return null;
}

function mapBanner(doc) {
  const banner = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(banner._id), title: banner.titulo || '', subtitle: banner.subtitulo || '',
    buttonText: banner.textoBoton || '', href: banner.enlace || '/tienda',
    desktop: banner.imagenUrl, mobile: banner.imagenMobileUrl || banner.imagenUrl,
    desktopPublicId: banner.imagenPublicId || '', mobilePublicId: banner.imagenMobilePublicId || '',
    active: Boolean(banner.activo), position: banner.alineacion || 'Centro',
    desktopFocusX: banner.escritorioX ?? 50, desktopFocusY: banner.escritorioY ?? 50,
    desktopZoom: banner.escritorioZoom ?? 120, mobileFocusX: banner.celularX ?? 50,
    mobileFocusY: banner.celularY ?? 50, mobileZoom: banner.celularZoom ?? 120,
    start: banner.empiezaEn ? dateInArgentina(banner.empiezaEn) : '',
    end: banner.terminaEn ? dateInArgentina(banner.terminaEn) : ''
  };
}

function dateInArgentina(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const part = Object.fromEntries(parts.map(({ type, value: item }) => [type, item]));
  return `${part.year}-${part.month}-${part.day}`;
}

function validateBanner(banner) {
  if (!banner || typeof banner !== 'object' || Array.isArray(banner)) throw AppError.solicitudInvalida('Configuración de banner inválida');
  if (typeof banner.id !== 'string' || !banner.id || typeof banner.title !== 'string' || typeof banner.subtitle !== 'string' ||
    typeof banner.buttonText !== 'string' || typeof banner.href !== 'string') throw AppError.solicitudInvalida('Los datos del banner no son válidos');
  const allowed = new Set(['id', 'title', 'subtitle', 'buttonText', 'href', 'desktop', 'mobile', 'active', 'position',
    'desktopFocusX', 'desktopFocusY', 'desktopZoom', 'mobileFocusX', 'mobileFocusY', 'mobileZoom', 'start', 'end', 'desktopFileIndex', 'mobileFileIndex']);
  if (Object.keys(banner).some((key) => !allowed.has(key))) throw AppError.solicitudInvalida('El banner contiene campos no permitidos');
  for (const key of ['title', 'subtitle', 'buttonText', 'href']) {
    if (banner[key] !== undefined && (typeof banner[key] !== 'string' || banner[key].length > ({ title: 100, subtitle: 240, buttonText: 40, href: 300 })[key])) {
      throw AppError.solicitudInvalida('Los datos del banner no son válidos');
    }
  }
  if (banner.href && !(/^\/(?!\/)/.test(banner.href) || /^https:\/\//i.test(banner.href))) throw AppError.solicitudInvalida('El enlace del banner no es válido');
  if (typeof banner.active !== 'boolean') throw AppError.solicitudInvalida('El estado activo del banner no es válido');
  if (!['Centro', 'Izquierda', 'Derecha', 'Abajo'].includes(banner.position)) throw AppError.solicitudInvalida('La posición del banner no es válida');
  for (const key of ['desktopFocusX', 'desktopFocusY', 'mobileFocusX', 'mobileFocusY']) {
    if (!Number.isInteger(banner[key]) || banner[key] < 0 || banner[key] > 100) throw AppError.solicitudInvalida('El encuadre del banner no es válido');
  }
  for (const key of ['desktopZoom', 'mobileZoom']) {
    if (!Number.isInteger(banner[key]) || banner[key] < 100 || banner[key] > 200) throw AppError.solicitudInvalida('El zoom del banner no es válido');
  }
  for (const key of ['start', 'end']) {
    if (!banner[key]) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(banner[key]) || Number.isNaN(Date.parse(`${banner[key]}T00:00:00Z`)) ||
      new Date(`${banner[key]}T00:00:00Z`).toISOString().slice(0, 10) !== banner[key]) throw AppError.solicitudInvalida('La fecha del banner no es válida');
  }
  if (banner.start && banner.end && banner.end < banner.start) throw AppError.solicitudInvalida('El fin del banner no puede ser anterior al inicio');
}

function createAdminBannerService({ Banner, Configuracion }, { storage, now = () => new Date() } = {}) {
  if (!Banner || !Configuracion || !storage) throw new Error('Admin banner dependencies are required');

  async function list() {
    const [rows, setting] = await Promise.all([
      Banner.find({ administrado: true, archivado: { $ne: true } }).sort({ posicion: 1, _id: 1 }).lean(),
      Configuracion.findById(REVISION_KEY).lean()
    ]);
    const currentRevision = setting ? Number(setting.valor) || 0 : 0;
    if (rows.length) return { revision: currentRevision, banners: rows.map(mapBanner), administrados: true };
    if (setting) return { revision: currentRevision, banners: [], administrados: true };
    return {
      revision: 0,
      administrados: false,
      banners: [{ id: BUILTIN_ID, title: '', subtitle: '', buttonText: '', href: '/tienda', desktop: BUILTIN_IMAGE, mobile: BUILTIN_IMAGE,
        active: true, position: 'Centro', desktopFocusX: 50, desktopFocusY: 50, desktopZoom: 120,
        mobileFocusX: 50, mobileFocusY: 50, mobileZoom: 120, start: '', end: '' }]
    };
  }

  async function publicList() {
    const setting = await Configuracion.findById(REVISION_KEY).lean();
    if (!setting) return { administrados: false, banners: [] };
    const current = now();
    const rows = await Banner.find({ administrado: true, archivado: { $ne: true }, activo: true,
      $and: [{ $or: [{ empiezaEn: null }, { empiezaEn: { $exists: false } }, { empiezaEn: { $lte: current } }] },
        { $or: [{ terminaEn: null }, { terminaEn: { $exists: false } }, { terminaEn: { $gte: current } }] }]
    }).sort({ posicion: 1, _id: 1 }).lean();
    return { administrados: true, banners: rows.map(mapBanner).map(({ desktopPublicId, mobilePublicId, ...banner }) => banner) };
  }

  async function save(input, files = []) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['revision', 'banners'].includes(key))) {
      throw AppError.solicitudInvalida('La configuración de banners no es válida');
    }
    if (!input || !Array.isArray(input.banners) || input.banners.length > MAX_BANNERS || !Number.isInteger(input.revision) || input.revision < 0) {
      throw AppError.solicitudInvalida('La configuración de banners no es válida');
    }
    const banners = input.banners;
    const ids = banners.map((banner) => banner.id);
    if (new Set(ids).size !== ids.length) throw AppError.solicitudInvalida('No se permiten banners repetidos');
    banners.forEach(validateBanner);
    const old = await Banner.find({ administrado: true, archivado: { $ne: true } }).lean();
    const oldById = new Map(old.map((item) => [String(item._id), item]));
    for (const banner of banners) {
      if (banner.id !== BUILTIN_ID && !banner.id.startsWith('new-') && !mongoose.isValidObjectId(banner.id)) throw AppError.solicitudInvalida('Identificador de banner inválido');
      if (mongoose.isValidObjectId(banner.id) && !oldById.has(banner.id)) throw AppError.solicitudInvalida('El banner no existe');
      for (const key of ['desktopFileIndex', 'mobileFileIndex']) if (banner[key] !== undefined && (!Number.isInteger(banner[key]) || banner[key] < 0 || banner[key] >= files.length)) throw AppError.solicitudInvalida('Archivo de imagen inválido');
    }
    const fileIndexes = banners.flatMap((banner) => [banner.desktopFileIndex, banner.mobileFileIndex].filter((index) => index !== undefined));
    if (fileIndexes.length !== files.length || new Set(fileIndexes).size !== files.length) throw AppError.solicitudInvalida('Cada imagen cargada debe estar asociada a un banner');
    const uploaded = [];
    const uploadAt = async (index) => {
      if (index === undefined) return null;
      const file = files[index];
      const parsed = parseImage(file?.buffer);
      if (!parsed || !['image/jpeg', 'image/png', 'image/webp'].includes(parsed.format) || file.mimetype !== parsed.format ||
        file.size > MAX_FILE_SIZE || parsed.width < 320 || parsed.height < 180 || parsed.width > 6000 || parsed.height > 6000 || parsed.width * parsed.height > MAX_PIXELS) {
        throw AppError.solicitudInvalida('La imagen debe ser JPG, PNG o WebP, medir al menos 320×180 y no superar los límites permitidos');
      }
      const stored = await storage.upload(file, { publicId: `olla-vegana/banners/${crypto.randomUUID()}` });
      if (!stored.url || !stored.publicId || !stored.url.startsWith('https://')) throw new AppError('No se pudo guardar la imagen', 503);
      uploaded.push(stored);
      return stored;
    };
    try {
      const prepared = [];
      for (let position = 0; position < banners.length; position += 1) {
        const banner = banners[position];
        const current = oldById.get(banner.id);
        const desktopUpload = await uploadAt(banner.desktopFileIndex);
        const mobileUpload = await uploadAt(banner.mobileFileIndex);
        const desktop = desktopUpload
          ? { url: desktopUpload.url, publicId: desktopUpload.publicId }
          : current && banner.desktop === current.imagenUrl ? { url: current.imagenUrl, publicId: current.imagenPublicId || '' }
            : banner.desktop === BUILTIN_IMAGE ? { url: BUILTIN_IMAGE, publicId: '' } : null;
        if (!desktop) throw AppError.solicitudInvalida('Cada banner necesita una imagen desktop válida');
        const mobile = mobileUpload
          ? { url: mobileUpload.url, publicId: mobileUpload.publicId }
          : current && banner.mobile === current.imagenMobileUrl ? { url: current.imagenMobileUrl, publicId: current.imagenMobilePublicId || '' }
            : current && banner.mobile === current.imagenUrl ? { url: current.imagenUrl, publicId: current.imagenPublicId || '' }
              : banner.mobile === BUILTIN_IMAGE ? { url: BUILTIN_IMAGE, publicId: '' } : desktop;
        const parseDate = (date, end = false) => date ? new Date(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}-03:00`) : undefined;
        prepared.push({ id: mongoose.isValidObjectId(banner.id) ? banner.id : null, sourceId: banner.id,
          document: { imagenUrl: desktop.url, imagenPublicId: desktop.publicId, imagenMobileUrl: mobile.url, imagenMobilePublicId: mobile.publicId,
            administrado: true, dispositivo: 'ESCRITORIO', posicion, posicionImagen: `${banner.desktopFocusX}% ${banner.desktopFocusY}%`,
            titulo: banner.title.trim(), subtitulo: banner.subtitle.trim(), textoBoton: banner.buttonText.trim(), enlace: banner.href || '/tienda', alineacion: banner.position,
            escritorioX: banner.desktopFocusX, escritorioY: banner.desktopFocusY, escritorioZoom: banner.desktopZoom,
            celularX: banner.mobileFocusX, celularY: banner.mobileFocusY, celularZoom: banner.mobileZoom,
            empiezaEn: parseDate(banner.start), terminaEn: parseDate(banner.end), activo: banner.active } });
      }

      const session = await Banner.db.startSession();
      try {
        await session.withTransaction(async () => {
          const setting = await Configuracion.findById(REVISION_KEY).session(session).lean();
          const actualRevision = setting ? Number(setting.valor) || 0 : 0;
          if (actualRevision !== input.revision) throw AppError.conflicto('Otra administradora guardó cambios. Actualizá la pantalla antes de volver a guardar.');
          const keepIds = prepared.filter((item) => item.id).map((item) => item.id);
          await Banner.updateMany({ administrado: true, archivado: { $ne: true }, ...(keepIds.length ? { _id: { $nin: keepIds } } : {}) },
            { $set: { archivado: true, activo: false } }, { session });
          for (const item of prepared) {
            if (item.id) await Banner.updateOne({ _id: item.id, administrado: true, archivado: { $ne: true } },
              { $set: { ...item.document, archivado: false } }, { session, runValidators: true });
            else {
              const [created] = await Banner.create([{ ...item.document, archivado: false }], { session });
              item.createdId = String(created._id);
            }
          }
          const nextRevision = actualRevision + 1;
          if (setting) {
            const updated = await Configuracion.updateOne({ _id: REVISION_KEY, valor: setting.valor }, { $set: { valor: String(nextRevision) } }, { session });
            if (updated.matchedCount !== 1) throw AppError.conflicto('Otra administradora guardó cambios. Actualizá la pantalla antes de volver a guardar.');
          }
          else await Configuracion.create([{ _id: REVISION_KEY, valor: String(nextRevision) }], { session });
        });
      } finally { await session.endSession(); }
      return list();
    } catch (error) {
      const commitMayHaveSucceeded = typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('UnknownTransactionCommitResult');
      if (!commitMayHaveSucceeded) await Promise.allSettled(uploaded.map((file) => storage.remove(file.publicId)));
      throw error;
    }
  }

  return { list, publicList, save };
}

module.exports = { createAdminBannerService, parseImage, BUILTIN_IMAGE, BUILTIN_ID, REVISION_KEY };
