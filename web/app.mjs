import { getImage } from '../web/util.mjs'
import { CanvasEventManager } from '../lib/CanvasManager.mjs'
import * as InventoryWindows from '../lib/inventories.mjs'
import pwindow from './pwindow.mjs'

window.canvas = document.getElementById('demo')
const canvasManager = new CanvasEventManager(window.canvas)

const testItems = [
  'item/brick',
  'block/brain_coral',
  'item/redstone',
  'block/powered_rail_on',
  'block/dirt',
  'item/apple',
  'item/compass_00'
]

const getImageIcon = (item) => {
  return { path: testItems[item.type] }
}

let inventory = new InventoryWindows.PlayerWin(canvasManager, {
  getImage, getImageIcon
})

canvasManager.setScale(3)


window.manager = pwindow(inventory)

console.log('Rendering')
canvasManager.startRendering()

function randomBetween (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function renderTesting () {
  const windowMap = inventory.getWindowMap()

  for (const key in windowMap) {
    const size = windowMap[key][1] ? Math.abs(windowMap[key][1] - windowMap[key][0]) + 1 : 1
    const getRandomItem = () => new window.Item(randomBetween(0, testItems.length - 1), randomBetween(1, 64))
    const arr = new Array(size).fill(0).map(getRandomItem)
    inventory[key] = arr
  }

  inventory.needsUpdate = true
}

function clearWindow () {
  const windowMap = inventory.getWindowMap()

  for (const key in windowMap) {
    inventory[key] = []
  }
}

window.toggleTesting = () => {
  globalThis.TESTING = !globalThis.TESTING
  if (globalThis.TESTING) {
    renderTesting()
  } else {
    clearWindow()
  }
}

window.toggleAnimations = () => {
  globalThis.debuggingInventory = !globalThis.debuggingInventory
  window.updateWin()
}

window.setScale = (scale) => {
  canvasManager.setScale(scale)
}

window.updateWin = () => {
  canvasManager.reset()
  const selWindow = document.getElementById('active-win').value
  inventory = new InventoryWindows[selWindow](canvasManager, { getImage, getImageIcon })
  canvasManager.slideInUp(inventory)
  inventory.needsUpdate = true

  if (globalThis.TESTING) {
    renderTesting()
  }
}
