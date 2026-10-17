// Round stripe boundaries to backing-canvas pixels, keeping edges sharp.
export function stripeBands(top, bottom, colors) {
  return colors.map((color, index) => {
    const y = Math.round(top + (bottom - top) * index / colors.length);
    const end = Math.round(top + (bottom - top) * (index + 1) / colors.length);
    return { color, y, height: end - y };
  });
}

export function createPrideTrailRenderer(sourceFrames) {
  const masks = sourceFrames.map(paths => {
    const path = new Path2D();
    const rows = [];
    for (const item of paths.filter(item => item.fill.startsWith('#04F601'))) {
      path.addPath(new Path2D(item.d));
      for (const match of item.d.matchAll(/M\d+ (\d+)/g)) rows.push(Number(match[1]));
    }
    return { path, top: Math.min(...rows) * 3, bottom: (Math.max(...rows) + 1) * 3 };
  });
  const layer = document.createElement('canvas');
  layer.width = 288;
  layer.height = 96;
  const context = layer.getContext('2d');

  return (frame, colors) => {
    const mask = masks[frame];
    context.clearRect(0, 0, layer.width, layer.height);
    for (const band of stripeBands(mask.top, mask.bottom, colors)) {
      context.fillStyle = band.color;
      context.fillRect(0, band.y, layer.width, band.height);
    }
    context.save();
    context.globalCompositeOperation = 'destination-in';
    context.scale(3, 3);
    context.fillStyle = '#FFFFFF';
    context.fill(mask.path);
    context.restore();
    return layer;
  };
}
