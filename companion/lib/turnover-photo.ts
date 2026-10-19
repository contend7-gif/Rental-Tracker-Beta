export async function prepareTurnoverPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || !file.size || file.size > 30 * 1024 * 1024) throw new Error('Choose a photo up to 30 MB.');
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 700 * 1024) return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('This photo could not be opened. Try a JPEG, PNG or screenshot from your gallery.'); }
  try {
    let scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 7; attempt++) {
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Photo preparation is unavailable.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare photo.')), 'image/jpeg', Math.max(0.55, 0.85 - attempt * 0.05)));
      if (blob.size <= 700 * 1024) return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'turnover'}.jpg`, { type: 'image/jpeg' });
      scale *= 0.8;
    }
  } finally { bitmap.close(); }
  throw new Error('This photo is still too large. Try a smaller photo or screenshot.');
}
