//@ts-check
export class CanvasEventManager {
  lastCursorPosition = { x: 0, y: 0 }
  needsInputUpdate = false
  rendering = false
  scale = 1
  minimizedWindow = false
  windowWidth = 200
  windowHeight = 200
  /**
   * @type {import('./InventoryWindow.mjs').InventoryWindow[]}
   */
  children = []
  forceRender = false
  // todo rename to onClickOutside
  onClose = () => {
    console.log('close')
  }

  constructor (/** @type {HTMLCanvasElement} */canvas) {
    this.canvas = canvas
    this.ctx = /** @type {CanvasRenderingContext2D} */(canvas.getContext('2d'))
    this.ctx.imageSmoothingEnabled = false
    canvas.onmousemove = this.onCursorMove
    canvas.onmousedown = this.onCursorClick
    canvas.onmouseup = this.onCursorRelease
    canvas.tabIndex = 1 // Allow us to capture key presses
    canvas.style.outline = 'none' // remove the outline
    canvas.addEventListener('keydown', this.onKeyDown)
    canvas.addEventListener('keyup', this.onKeyUp, { passive: true })
    canvas.addEventListener('wheel', this.onWheel)

    canvas.oncontextmenu = e => e.preventDefault()

    let startHold = { x: 0, y: 0, time: 0 }
    canvas.onpointerdown = (e) => {
      startHold = { x: e.clientX, y: e.clientY, time: Date.now() }
    }
    // emulate right click
    canvas.onpointerup = (e) => {
      if (Date.now() - startHold.time > 500 && Math.abs(e.clientX - startHold.x) < 5 && Math.abs(e.clientY - startHold.y) < 5) {
        this.onCursorClick({ ...e, button: 2 })
      }
    }
  }

  /**
   * @param {number} scale
   */
  setScale (scale) {
    this.scale = scale
    scale *= devicePixelRatio
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(scale, scale)
    this.ctx.imageSmoothingEnabled = false

    for (const child of this.children) {
      child.scale = scale
    }
  }

  // Translates cursor page position to canvas relative position
  getMousePos (canvas, evt) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
      y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    }
  }

  // Translates canvas DOM position to context scaled position
  getCanvasCoords (ctx, screenX, screenY) {
    const matrix = ctx.getTransform()
    const imatrix = matrix.invertSelf()
    const x = screenX * imatrix.a + screenY * imatrix.c + imatrix.e
    const y = screenX * imatrix.b + screenY * imatrix.d + imatrix.f
    return { x, y }
  }

  pos (evt) {
    const pos = this.getMousePos(this.canvas, evt)
    return this.getCanvasCoords(this.ctx, pos.x, pos.y)
  }

  onCursorMove = (evt) => {
    this.lastCursorPosition = this.pos(evt)
    // if (this.children[0]) {}
    this.needsInputUpdate = true
  }

  onCursorClick = (evt) => {
    const { x, y } = this.pos(evt)
    const secondary = evt.button === 2 // Right click
    const inv = this.children[0]
    const {x:canvasWidth, y:canvasHeight} = this.getCanvasCoords(this.ctx, this.canvas.width, this.canvas.height)
    this.children.forEach(child => {
      child.canvasWidth = canvasWidth
      child.canvasHeight = canvasHeight
    })
    // todo
    if (!secondary && (x < inv.xoff || (y < inv.yoff && x < canvasWidth - inv.xoff))) {
      this.onClose()
    } else {
      this.children.forEach(e => e.onCanvasMouseDown(x, y, secondary))
    }
  }

  onCursorRelease = (evt) => {
    const { x, y } = this.pos(evt)
    this.children.forEach(e => e.onCanvasMouseUp())
  }

  onWheel = evt => {
    const { x, y } = this.pos(evt)
    this.children.forEach(e => e.onCanvasScroll(x, y, evt.deltaY) ? evt.preventDefault() : null)
  }

  onKeyDown = (evt) => this.children.forEach(e => e.onCanvasKeyDown(evt.key, evt.code) ? evt.preventDefault() : null)
  onKeyUp = (evt) => this.children.forEach(e => e.onCanvasKeyUp(evt.key, evt.code) ? evt.preventDefault() : null)

  centerLayout() {
    if (!this.minimizedWindow) {
      this.canvas.width = window.innerWidth * devicePixelRatio
      this.canvas.height = window.innerHeight * devicePixelRatio
      this.canvas.style.width = `${window.innerWidth}px`
      this.canvas.style.height = `${window.innerHeight}px`
      for (const inventory of this.children) {
        const [w, h] = Object.values(inventory.layout[0].with)[0].slice.slice(-2)

        const centeredStartX = (this.canvas.width - w * inventory.scale) / 2
        const centeredStartY = (this.canvas.height - h * inventory.scale) / 2

        inventory.xoff = centeredStartX / inventory.scale
        inventory.yoff = centeredStartY / inventory.scale
      }
    } else {
      this.canvas.width = this.windowWidth * devicePixelRatio
      this.canvas.height = this.windowHeight * devicePixelRatio
      this.canvas.style.width = `${this.windowWidth}px`
      this.canvas.style.height = `${this.windowHeight}px`
    }
  }

  clear () {
    if (this.index !== 0) {
      return;
    }
    this.centerLayout()
    this.setScale(this.scale)
    if (!this.minimizedWindow) {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  messageTicks = 0

  displayBlockingMessage (message, forLength = 200) {
    this.message = message
    this.messageTicks = forLength
  }

  delay = 40

  async slideInUp (layout) { // for testing positioning, leaving because it looks cool :D
    // todo restore
    this.delay = 2
    for (let i = 30; i >= 0; i -= 2) {
      layout.yoff = i
      await new Promise(resolve => setTimeout(resolve, 0))
      layout.needsUpdate = true
    }
    this.delay = 40
  }

  reset () {
    this.children = []
  }

  startRendering () {
    this.rendering = true
    // for (const child of this.children) {
    //   subscribe(child, () => { control rendering })
    // }
    const loop = () => {
      this.index = 0
      if (this.messageTicks > 0) {
        this.ctx.fillStyle = '#20202020'
        this.ctx.fillRect(0, 8, this.canvas.width, 20)
        this.ctx.fillStyle = 'white'
        this.ctx.fillText(this.message, 12, 20)
      } else {
        for (const child of this.children) {
          child.render(this.children.length > 0 || this.forceRender)
          this.index++
        }
      }

      this.messageTicks--

      if (this.rendering) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  stopRendering () {
    this.rendering = false
  }

  destroy() {
    this.stopRendering()
    this.children = []
    this.canvas.remove()
  }
}
