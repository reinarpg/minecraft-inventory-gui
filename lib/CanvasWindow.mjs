import { SimpleEmitter } from './util/emitter.mjs'

export class BB {
  constructor (minX, minY, dx, dy, xoff = 0, yoff = 0) {
    this.minX = minX + xoff
    this.minY = minY + yoff
    this.maxX = this.minX + dx
    this.maxY = this.minY + dy
    this.contains = (x, y) => x > this.minX && y > this.minY && x < this.maxX && y < this.maxY
    this.bbRel = [this.minX, this.minY, dx, dy]
    this.bbAbs = [this.minX, this.minY, this.maxX, this.maxY]
  }
}

export function getDistance (x1, y1, x2, y2) {
  const a = x1 - x2
  const b = y1 - y2
  const c = Math.sqrt(a * a + b * b)
  return c
}

export class CanvasWindow extends SimpleEmitter {
  scale = 1
  fontOverride
  /** @type {CanvasRenderingContext2D} */
  drawCtx

  drawItem (obj, x, y) {
    const icon = obj.icon ?? this.getImageIcon(obj)
    if (!icon) return
    obj.icon ??= icon
    if (obj.blockData) {
      for (const side of ['left', 'right', 'top']) {
        const data = obj.blockData[side]
        let s = this.scale
        this.drawCubeSide(this.drawCtx, x * s, y * s, 16 * s, side, (x, y, size) => {
          this.drawImage(this.getImageIcon(data), x, y, data.slice, data.scale, size, size)
        })
      }
    } else {
      this.drawImage(icon, x, y, icon.slice, icon.scale)
    }
    this.drawText({ value: obj.count !== undefined && obj.count !== 1 ? obj.count : '', stroke: true, fontStyle: 'normal 9px sans-serif', style: 'white' }, x + 11, y + 16)
  }

  drawImage (obj, dx, dy, slice, scale, width, height) {
    this.drawCtx.save()

    dx ||= 0; dy ||= 0
    const img = this.getImage(obj)
    scale = scale || 1
    // dx *= this.scale
    // dy *= this.scale
    if (slice) {
      this.drawCtx.drawImage(img, slice[0], slice[1], slice[2], slice[3], dx, dy, width ?? slice[2] * scale, height ?? slice[3] * scale)
    } else {
      this.drawCtx.drawImage(img, dx, dy, width ?? img.width, height ?? img.height)
    }

    this.drawCtx.restore()
  }

  drawCubeSide(ctx, x, y, size, side, drawSide) {
    ctx.save()
    const oldFillStyle = ctx.fillStyle
    // reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    x = x - size * 0.4
    y = y - size * 0.5
    let s = size / 2

    const skewFactor = 0.5

    if (side === 'left') {
        // Apply transformation for the left side
        ctx.transform(1 - 0.1, skewFactor, 0, 1, x, y)
        drawSide(s, s, s, s)
        // todo adjust values to match better styling
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.fillRect(s, s, s, s)
    }

    if (side === 'right') {
        // Apply transformation for the right side
        ctx.transform(1 - 0.1, -skewFactor, 0, 1, x, y)
        drawSide(s + s - 1, s * 3 - 1, s, s)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(s + s - 1, s * 3 - 1, s, s)
    }

    if (side === 'top') {
        // Apply transformation for the top side
        ctx.transform(1 - 0.1, -skewFactor, 1 - 0.1, skewFactor, x, y)
        drawSide(-s - 1, s * 2, s, s)
    }

    ctx.fillStyle = oldFillStyle
    ctx.restore()
  }

  drawText ({ fontStyle = '', style, value, align = undefined, w = undefined, bg, stroke }, x = 0, y = 0) {
    // x *= this.scale
    // y *= this.scale
    this.drawCtx.save()
    this.drawCtx.font = this.fontOverride || fontStyle || 'normal normal 11px sans-serif'
    this.drawCtx.font = this.drawCtx.font.replace('sans-serif', 'minecraft,mojangles,monospace')
    const measured = this.drawCtx.measureText(value)
    // const aw = Math.abs(measured.actualBoundingBoxLeft) + Math.abs(measured.actualBoundingBoxRight)
    if (align === 'center') {
      x = this.xoff + (w / 2) - (measured.width / 2)
    }

    if (bg) {
      // this.drawCtx.fillStyle = '#010101B0'
      this.drawCtx.fillStyle = 'black'
      const RECT_X_PADDING = 5;
      const RECT_Y_OFFSET = 10;
      const RECT_HEIGHT = 14;
      const RECT_CORNER_RADIUS = 2;

      this.drawRoundRect(x - RECT_X_PADDING, y - RECT_Y_OFFSET, measured.width + RECT_X_PADDING * 2, RECT_HEIGHT, RECT_CORNER_RADIUS).fill();
    }

    if (stroke) {
      this.drawCtx.fillStyle = '#222'
      this.drawCtx.fillText(value, x+1, y+1)
    }
    this.drawCtx.fillStyle = style || 'black'
    this.drawCtx.fillText(value, x, y)

    // restore
    this.drawCtx.restore()
  }

  drawBox (aroundBB) {
    this.drawCtx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    this.drawCtx.fillRect(...aroundBB)
  }

  drawInput (obj, [x, y, mx], text) {
    this.drawCtx.fillStyle = '#FFFFFF'
    const measured = this.drawCtx.measureText(text)
    const lPadding = obj.leftPad ?? 2
    const rPadding = obj.rightPad ?? 4
    this.drawCtx.font = obj.fontStyle ?? 'normal normal 8px sans-serif'
    const fontHeight = measured.fontBoundingBoxAscent + measured.fontBoundingBoxDescent
    this.drawCtx.fillText(text, x + lPadding, fontHeight + y, mx - rPadding)
  }

  // https://stackoverflow.com/a/7838871
  drawRoundRect (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    this.drawCtx.beginPath()
    this.drawCtx.moveTo(x + r, y)
    this.drawCtx.arcTo(x + w, y, x + w, y + h, r)
    this.drawCtx.arcTo(x + w, y + h, x, y + h, r)
    this.drawCtx.arcTo(x, y + h, x, y, r)
    this.drawCtx.arcTo(x, y, x + w, y, r)
    this.drawCtx.closePath()
    return this.drawCtx
  }
}
