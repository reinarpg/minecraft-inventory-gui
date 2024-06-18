//@ts-check
import { BB, getDistance, CanvasWindow } from './CanvasWindow.mjs'
import { layouts } from './layouts.mjs'
import { proxy } from 'valtio/vanilla'

export class InventoryWindow extends CanvasWindow {
  callbacks = {
    getItemRecipes(item) {
      return []
    },
    getItemUsages(item) {
      return []
    },
    onClose() {},
    sortItems() {},
    macros() {},
    toggleJei() {},
  }

  /** @type {[layoudId: string, schemes?: any[]][]} */
  prevLayouts = []
  messageDisplay = ''
  activeMessage = ''

  jeiSlots = []
  jeiSlotsPage = 0
  reactive = proxy({
    floatingItem: undefined
  })
  needsUpdate = true
  xoff = 0
  yoff = 0

  // to be changed
  canvasWidth = 0
  canvasHeight = 0

  disableHighlight = false

  _activeInput
  _sensitiveRegions = new Map()

  _boxHighlights = []
  _downListeners = []
  _downScrollbar
  _downKeys = new Set()

  /** @type {{x, y, time, double} | null} */
  _lastClick = null
  _lastHover = []

  /** @type {string} */
  //@ts-ignore
  layoutId = undefined
  layout = layouts[this.layoutId]

  /**
   * @param {import('./CanvasManager.mjs').CanvasEventManager} canvasManager
   * @param {*} dataProvider
   */
  constructor (canvasManager, dataProvider) {
    super()
    canvasManager.children.push(this)
    this.can = canvasManager
    this.drawCtx = canvasManager.ctx

    this.getImage = dataProvider.getImage
    this.getImageIcon = dataProvider.getImageIcon
  }

  onCanvasMouseDown (x, y, secondary) {
    this._activeInput = null
    let double = false
    if (this._lastClick) {
      const dist = getDistance(x, y, this._lastClick.x, this._lastClick.y)
      const timeDelta = Date.now() - this._lastClick.time
      if (dist < 0.5 && timeDelta < 500 && !this._lastClick.double) {
        double = true
      }
    }

    for (const [bb, id, type, handler, data] of this._sensitiveRegions.values()) {
      if (bb.contains(x, y) && type.includes('click')) {
        let str = double ? 'doubleclick' : 'click'
        if (secondary) str = 'right' + str
        this[handler](id, str, [x, y], data)
        this._downListeners.push([handler, id])
      }
    }
    this._lastClick = { x, y, time: Date.now(), double }
  }

  onCanvasMouseUp () {
    this._downListeners.forEach(([handler, id]) => this[handler](id, 'release', [this.can.lastCursorPosition.x, this.can.lastCursorPosition.y]))
    this._downListeners = []
  }

  onCanvasScroll (x, y, delta) {
    for (const [bb, id, type, handler, data] of this._sensitiveRegions.values()) { // eslint-disable-line no-unused-vars
      if (bb.contains(x, y) && type.includes('scroll')) {
        this[handler](data, 'scroll', [x, y], delta)
        this.needsUpdate = true
        return true
      }
    }
  }

  $ (elementId) {
    return this['$' + elementId]
  }

  // Called when a key is pressed, returns true if we should capture
  onCanvasKeyDown (key, code) {
    this._downKeys.add(code)
    if (this._activeInput && this.$(this._activeInput)) {
      const varId = this.$(this._activeInput).variable
      if (key.length === 1) { // detect character, better way to do this?
        this[varId] += key
      } else if (code === 'Backspace') {
        this[varId] = this[varId].slice(0, -1)
      } else if (code === 'Escape') {
        this._activeInput = null
        return
      }
      this.onInputBoxInteract(this._activeInput, 'press', [])
      this.needsUpdate = true
      return true
    }

    if (code === 'Escape' && this.prevLayouts.length) {
      // this.prevLayouts
      return
    }

    if (code === 'Escape') {
      this.callbacks.onClose()
      return true
    }

    if (code === 'Backspace' && this.prevLayouts) {
      const prev = this.prevLayouts.pop()
      if (prev) {
        // TODO!
        // if (prev[1]) {
        // } else {
        //   this.layoutId = prev[0]
        //   this.layout = [layouts[this.layoutId]]
        //   this.needsUpdate = true
        // }
        // this.updateGuideItemsFromScheme()
      }
      return true
    }

    if (code === 'KeyY') {
      this.callbacks.sortItems()
    }
    if (code === 'KeyI') {
      this.callbacks.macros()
    }
    if (code === 'KeyJ') {
      this.callbacks.toggleJei()
    }

    const showRecipes = code === 'KeyR';
    const showUsages = code === 'KeyU';
    if ((showRecipes || showUsages) && this.currentHighlightData?.length === 2) {
      const [itemsType, index] = this.currentHighlightData
      const item = this[itemsType][index]
      this.showRecipesOrUsages(showRecipes, item)
    }
  }

  showRecipesOrUsages(showRecipes, item) {
    // todo don't make floating item buggy
    if (!(!this.reactive.floatingItem && item)) {
      return;
    }

    const schemes = showRecipes ? this.callbacks.getItemRecipes(item) : this.callbacks.getItemUsages(item)
    if (Array.isArray(schemes)) {
      const prevGuide = this.currentGuide
      this.currentGuide = {
        page: 0,
        schemes
      }
      const [items] = schemes
      if (items) {
        this.updateGuideItemsFromScheme(items, [this.layoutId, prevGuide])
      }
    }
  }

  /** @type {(key, code) => any} */
  onCanvasKeyUp (key, code) {
    this._downKeys.delete(code)
  }

  registerSensitive (regionBB, type, id, handler, data) {
    this._sensitiveRegions.set(type + regionBB.bbRel.toString(), [regionBB, id, type, handler, data])
  }

  isActive (id) {
    return this._lastHover.includes(id)
  }

  updateCursorHighlights() {
    const { x, y } = this.can.lastCursorPosition
    this._boxHighlights = []
    if (this.disableHighlight) return
    const hitBBs = []
    const hitsIds = []
    this.currentHighlightData = null
    for (const [bb, id, type, handler, data] of this._sensitiveRegions.values()) {
      if (bb.contains(x, y) && type.includes('hover')) {
        hitBBs.push(bb.bbRel)
        hitsIds.push(id)
        this[handler](id, 'hover', [x, y], data)
        this.currentHighlightData = data
      }
    }
    for (const hit of hitBBs) {
      this._boxHighlights.push(hit)
    }
    for (const id of this._lastHover) {
      if (!hitsIds.includes(id)) {
        this.onTooltipEvent(id, 'release')
      }
    }
    this._lastHover = hitsIds
  }

  render (force) {
    this.layout ??= [layouts[this.layoutId]]
    if (this.can.needsInputUpdate) {
      this.updateCursorHighlights()
      this.can.needsInputUpdate = false
      this.needsUpdate = true
    }

    if (this.needsUpdate || force) {
      this._sensitiveRegions.clear()
      this.can.clear()
      this.renderLayout(this.layout)

      const SIZE = 16
      const imageSize = this.layout[0].type === 'image' ? this.layout[0]?.slice?.slice(2) : undefined
      // todo cleanup padding logic (jeiPadding is too big)
      const horizSlots = imageSize ? Math.floor((this.drawCtx.canvas.width / this.scale - (this.xoff + imageSize[0])) / SIZE) - 1 : 6
      const jeiPadding = 18

      const verticalSlots = ((this.drawCtx.canvas.height / this.scale) - jeiPadding * 2) / SIZE
      const totalSlots = horizSlots * verticalSlots
      this.jeiSliceSlots = this.jeiSlots.slice(this.jeiSlotsPage * totalSlots, (this.jeiSlotsPage + 1) * totalSlots)
      const totalPages = Math.ceil(this.jeiSlots.length / totalSlots)

      const sizeX = horizSlots * SIZE
      const startX = (this.drawCtx.canvas.width / this.scale - sizeX  - jeiPadding);
      const jeiLayout = [
        {
          type: 'itemgrid',
          containing: 'jeiSliceSlots',
          size: SIZE,
          y: jeiPadding,
          x: startX,
          width: horizSlots,
          height: verticalSlots
        },
        {
          type: 'text',
          value: 'Prev',
          x: startX,
          y: jeiPadding - 2,
        },
        {
          type: 'text',
          value: `${sizeX > 100 ? 'Page ' : 0}${this.jeiSlotsPage + 1}/${totalPages}`,
          // todo compute!
          x: startX + sizeX / 2 - 15,
          y: jeiPadding - 2,
        },
        {
          type: 'text',
          value: 'Next',
          x: startX + sizeX - 15,
          y: jeiPadding - 2,
        },
      ]
      const registerEventForText = (layout, val, handler) => {
        /** @type {any} */
        const layoutItem = layout.find(l => l.value === val)
        this.registerSensitive(new BB(
          layoutItem.x,
          layoutItem.y - 10,
          this.drawCtx.measureText(val).width + 10,
          15
        ), 'hover+click', undefined, handler)
      }
      if (this.jeiSlots.length > 0) {
        registerEventForText(jeiLayout, 'Prev', 'onClickPrev')
        registerEventForText(jeiLayout, 'Next', 'onClickNext')
        this.renderLayout(jeiLayout, 0, 0)
      }

      if (this.messageDisplay) {
        const layout = [{
          type: 'text',
          value: this.messageDisplay,
          fontStyle: 'normal normal 8px sans-serif',
          // above window
          x: this.xoff + 10,
          y: this.yoff - 3,
          style: 'white'
        }]
        this.renderLayout(layout, 0, 0)
      }

      if (this.activeMessage && this.layoutId === 'GenericDescription') {
        // render main content: item description
        const splitMessage = (/** @type {string} */ text) => {
          // const maxLineWidth = 45
          // const newLines = []
          // for (let i = 0; i <= text.length; i += maxLineWidth) {
          //   newLines.push(text.slice(i, i + maxLineWidth))
          // }
          // return newLines.join('\n')

          // split by words instead
          const wordsLimitPerLine = 6
          const words = text.split(' ')
          const lines = []
          let currentLine = ''
          for (const word of words) {
            if (currentLine.split(' ').length >= wordsLimitPerLine) {
              lines.push(currentLine)
              currentLine = ''
            }
            currentLine += word + ' '
          }
          lines.push(currentLine)
          return lines.join('\n')
        }
        const layout = [{
          type: 'text',
          value: splitMessage(this.activeMessage),
          fontStyle: 'normal normal 8px sans-serif',
          x: this.xoff + 10,
          y: this.yoff + 34,
          style: 'black'
        }, {
          type: 'text',
          value: 'Minecraft Wiki',
          fontStyle: 'normal normal 8px sans-serif',
          x: this.xoff + this.getWidthHeight()[0] - 58,
          y: this.yoff + this.getWidthHeight()[1] - 8,
        }]
        this.renderLayout(layout, 0, 0)
        registerEventForText(layout, 'Minecraft Wiki', 'onClickWiki')
      }

      if (this.currentGuide) {
        const guidesLayoutStart = {
          x: this.xoff + 5,
          y: this.yoff + 13
        }
        const guidesLayout = [
          {
            type: 'text',
            value: 'Prev',
            x: guidesLayoutStart.x + 0,
            y: guidesLayoutStart.y + 0
          },
          {
            type: 'text',
            value: `Recipes ${this.currentGuide.page + 1}/${this.currentGuide.schemes.length}`,
            x: guidesLayoutStart.x + 50,
            y: guidesLayoutStart.y + 0,
          },
          {
            type: 'text',
            value: 'Next',
            x: guidesLayoutStart.x + 140,
            y: guidesLayoutStart.y + 0,
          }
        ]
        this.renderLayout(guidesLayout, 0, 0)
        registerEventForText(guidesLayout, 'Prev', 'onClickPrevGuide')
        registerEventForText(guidesLayout, 'Next', 'onClickNextGuide')
      }

      this.renderOverlays()
      this.needsUpdate = false
    }
  }

  onClickWiki(id, type) {
    if (type !== 'click' && type !== 'doubleclick') return
    const resultItem = this.resultItem[0]
    console.log('resultItem', resultItem)
    window.open(`https://minecraft.wiki/w/${resultItem.name}`)
  }

  onClickNext(id, type) {
    if (type !== 'click' && type !== 'doubleclick') return
    this.jeiSlotsPage = this.jeiSlotsPage + 1
  }
  onClickPrev(id, type) {
    if (type !== 'click' && type !== 'doubleclick') return
    this.jeiSlotsPage = this.jeiSlotsPage - 1
    if (this.jeiSlotsPage < 0) this.jeiSlotsPage = 0
  }

  updateGuideItemsFromScheme(scheme, prevLayoutData) {
    if (prevLayoutData) {
      this.prevLayouts.push(prevLayoutData)
    }
    const type = scheme[0]
    if (this.layoutId !== type) {
      this.layoutId = type
      this.layout = [layouts[type]]
    }

    if (type === 'CraftingTableGuide') {
      this.craftingItems = scheme[2]
    }
    this.resultItem = [scheme[1]]
    this.activeMessage = scheme[3]
    this.needsUpdate = true
  }

  onClickNextGuide(id, type) {
    if (type !== 'click' && type !== 'doubleclick') return
    if (!this.currentGuide) return
    const { page, schemes } = this.currentGuide
    const nextPageRepeating = page + 1 >= schemes.length ? 0 : page + 1
    const items = schemes[nextPageRepeating]
    this.currentGuide.page = nextPageRepeating
    this.updateGuideItemsFromScheme(items)
  }

  onClickPrevGuide(id, type) {
    if (type !== 'click' && type !== 'doubleclick') return
    if (!this.currentGuide) return
    const { page, schemes } = this.currentGuide
    const prevPageRepeating = page - 1 < 0 ? schemes.length - 1 : page - 1
    const items = schemes[prevPageRepeating]
    this.currentGuide.page = prevPageRepeating
    this.updateGuideItemsFromScheme(items)
  }

  renderOverlays () {
    for (const box of this._boxHighlights) {
      this.drawBox(box)
    }

    const { x, y } = this.can.lastCursorPosition
    if (this._tooltipText) {
      //@ts-ignore
      this.drawText({ bg: 1, value: this._tooltipText, style: 'white', fontStyle: 'normal normal 8px sans-serif', /* stroke: 'white' */ }, x + 12, y)
    }
    if (this.reactive.floatingItem) {
      this.drawItem(this.reactive.floatingItem, x - 8, y - 8)
    }
    //     this.drawText({ value: `Pos: x: ${this.can.lastCursorPosition.x} y: ${this.can.lastCursorPosition.y}`, fontStyle: 'normal normal 8px sans-serif'}, 0, 10)
  }

  index = 0

  getWidthHeight() {
    const [w, h] = Object.values(this.layout[0].with)[0].slice.slice(-2)
    return [w, h]
  }

  renderLayout (obj, xoff = this.xoff, yoff = this.yoff) {
    for (const key in obj) {
      const val = obj[key]
      // Assign an ID to this node, used for implementation and debugging
      if (!val.id) val.id = this.index++
      this['$' + val.id] = val

      let _using = val.using
      if (val.with) {
        Object.assign(this, val.with)
      }

      // Assign x and y to default of 0
      val.x ??= 0
      val.y ??= 0
      const x = val.x instanceof Function ? val.x(this) : val.x
      const y = val.y instanceof Function ? val.y(this) : val.y

      // Merge values from `using` value into current object
      if (_using) {
        if (val.using instanceof Function) {
          _using = val.using(this, val)
        }
        if (_using.includes('.')) {
          const [key, entry] = _using.split('.')
          Object.assign(val, layouts[key].with?.[entry])
        } else {
          Object.assign(val, this.layout[0].with[_using])
        }
      }

      // Run `if` condition to see if we should render this or not
      if (val.if) {
        const ctx = this
        if (val.if instanceof Function) {
          if (val.if(ctx, val) !== true) continue
        } else {
          throw new Error('if must be function')
        }
      }

      if (val.draw) { // Custom draw function
        val.draw(this, val, [val.x + xoff, val.y + yoff])
      } else if (val.type === 'image') {
        this.drawImage(val, x + xoff, y + yoff, val.slice, val.scale)
      } else if (val.type === 'input') {
        const bb = [...val.bb]
        bb[0] += xoff
        bb[1] += yoff
        this.registerSensitive(new BB(...bb), 'hover+click', val.id, 'onInputBoxInteract')
        //@ts-ignore
        this.drawInput(val, bb, this[val.variable])
      } else if (val.type === 'text') {
        if (val.containing) val.value = this[val.containing]
        this.drawText(val, val.x + xoff, val.y + yoff)
      } else if (val.type === 'container') {
        // A container passes down its X and Y positions to all its children
        this.renderLayout(val.children, x + xoff, y + yoff)
      } else if (val.type === 'itemgrid') { // Draw one or more items onto the screen in a grid.
        let i = 0
        // Some defaults
        val.width ??= 1; val.height ??= 1; val.size ??= 16; val.margin ??= 2; val.padding ??= 0
        if (val.ho) { // Scrollbar triggered horizontal offset
          i = val.ho * val.width
        }
        for (let _y = 0; _y < val.height; _y++) {
          for (let _x = 0; _x < val.width; _x++) {
            const bb = [val.x + (_x * val.size) + xoff + (_x * val.margin) + val.padding, val.y + (_y * val.size) + yoff + (_y * val.margin) + val.padding, val.size, val.size]
            // this.drawBox(bb)
            const item = this[val.containing][i]
            if (item) this.drawItem(item, bb[0], bb[1])
            if (val.padding) { // Apply padding to the bb
              bb[0] -= val.padding; bb[1] -= val.padding; bb[2] += val.padding * 2; bb[3] += val.padding * 2
            }
            this.registerSensitive(new BB(...bb), 'hover+click', val.id, 'onItemEvent', [val.containing, i])
            i++
          }
        }
      } else if (val.type === 'scrollbar') {
        const bb = new BB(...val.bb, xoff, yoff)
        // this.drawBox(bb.bbRel)
        this.registerSensitive(bb, 'hover+click', val.id, 'onScrollbarEvent', [bb, val])
        const inc = this[val.id + 'Increment']
        if (inc) {
          this.drawImage(val, val.x + xoff, val.y + yoff + inc.y, val.slice, val.scale)
        } else {
          this.drawImage(val, val.x + xoff, val.y + yoff, val.slice, val.scale)
        }
      } else if (val.type === 'box') {
        // Draw a simple bounding box around something. Helpful for debugging.
        this.drawBox([val.x + xoff, val.y + yoff, val.w ?? 10, val.h ?? 10], val.color)
      } else if (val.type === 'bar') {
        // Drawing a progress bar -- first we draw the background the the foreground.
        const using = this.layout[0].with
        const fg = using[val.fg]
        const bg = using[val.bg]
        const maxWidth = fg.slice[2]
        const progress = ((this[val.containing] ?? 100) / 100) * maxWidth
        this.drawImage(bg, val.x + xoff, val.y + yoff, bg.slice)
        this.drawImage(fg, val.x + xoff, val.y + yoff, [fg.slice[0], fg.slice[1], progress, fg.slice[3]])
      }

      if (val.tip) {
        const slice = val.slice ?? [0, 0, val.w, val.h]
        console.assert(slice, 'need a slice bb for sensitive region', val)

        const bb = [val.x + xoff, val.y + yoff, slice[2], slice[3]]
        // this.drawBox(bb)
        this.registerSensitive(new BB(...bb), 'hover', val.id, 'onTooltipEvent')
      }
      if (val.onClick) {
        const bb = [val.x + xoff, val.y + yoff, val.h ?? val.slice[2], val.w ?? val.slice[3]]
        this.registerSensitive(new BB(...bb), 'click', val.id, 'onClickEvent')
      }
      if (val.onScroll) {
        const bb = [val.x + xoff, val.y + yoff, val.h ?? val.slice[2], val.w ?? val.slice[3]]
        this.registerSensitive(new BB(...bb), 'scroll', val.id, 'onScrollbarEvent', val.onScroll)
        this.drawBox(bb)
      }

      if (val.children && val.type !== 'container') {
        this.renderLayout(val.children, xoff, yoff)
      }
    }
  }

  onInputBoxInteract (id, type, pos) {
    if (type === 'click') {
      this._activeInput = id
    }
  }

  onItemEvent (id, type, pos, data) {
    if (type === 'hover') {
      const [cont, i] = data
      const item = this[cont][i];
      this._tooltipText = item?.displayName
      if (item) {
        if (item.enchants?.length) {
          this._tooltipText += '\nEnchants: ' + item.enchants.map(e => `${e.name} - ${e.lvl}`).join(', ')
        }
        if (typeof item.maxDurability === 'number') {
          this._tooltipText += `\nDurability: ${(item.maxDurability - item.durabilityUsed)}/${item.maxDurability}`
        }
      }
    } else if (type === 'release') {
      this._tooltipText = ''
    }
    this.emit('itemEvent', id, type, pos, data)
  }

  onClickEvent (id, type, pos, data) {
    this.emit('click', id, type, pos, data)
  }

  onTooltipEvent (id, type, pos, data) {
    const val = this.$(id)
    if (type === 'hover') {
      this._tooltipText = val.tip
    } else {
      this._tooltipText = ''
    }
    this.emit('tooltip', id, type, pos, data)
  }

  onScrollbarEvent (id, type, [ax, ay], data) {
    if (type === 'release') {
      this._downScrollbar = null
    } else if (type === 'hover' && this._downScrollbar === id) {
      const [bb, val] = data
      const spHeight = val.slice[3]
      const bbHeight = val.bb[3]
      const adjustedY = ay - (spHeight / 2)
      const increment = { x: bb.maxY - ax, y: Math.max(0, Math.min(bbHeight - spHeight, adjustedY - bb.minY)) }
      this[val.id + 'Increment'] = increment
      this.emit('scrollbarUpdate', id, type, [ax, ay], increment)
    } else if (type === 'click') {
      this._downScrollbar = id
    } else if (type === 'scroll') {
      const val = this.$(id)
      const increment = (this[val.id + 'Increment'] ??= { y: 0 })
      increment.y += data > 0 ? 10 : -10
      this[val.id + 'Increment'].y = Math.max(0, Math.min(val.bb[3] - val.slice[3], increment.y))
      this.emit('scrollbarUpdate', id, type, [ax, ay], this[val.id + 'Increment'])
    }
  }
}
