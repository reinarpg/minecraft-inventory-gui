//@ts-check
import { getImage } from '../web/util.mjs'
import { showInventory } from './ext.mjs'

const testItems = [
  'item/brick',
  'block/brain_coral',
  'item/redstone',
  'block/powered_rail_on',
  'block/dirt',
  'item/apple',
  'item/compass_00'
]
const jeiTestItems = Array.from({ length: 1000 }, () => testItems[Math.floor(Math.random() * testItems.length)])

function randomBetween (min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const getImage2 = ({ path }) => {
  return getImage({ path })
}

let windowName = undefined
let { canvas, pwindow, inventory, canvasManager, destroy } = showInventory(undefined, getImage, {}, undefined)

const init = () => {
  destroy();
  ({ canvas, pwindow, inventory, canvasManager, destroy } = showInventory(windowName, getImage, {}, undefined))
  globalThis.canvas = canvas
  globalThis.pwindow = pwindow

  const getItem = testItem => ({ path: testItem, count: 2, displayName: testItem.split('/').pop() });
  pwindow.win.jeiSlots = jeiTestItems.map(getItem)
  pwindow.setSlots(testItems.map(getItem))
}
init()

function renderTesting () {
  const windowMap = inventory.getWindowMap()

  for (const key in windowMap) {
    const size = windowMap[key][1] ? Math.abs(windowMap[key][1] - windowMap[key][0]) + 1 : 1
    const getRandomItem = () => new globalThis.Item(randomBetween(0, testItems.length - 1), randomBetween(1, 64))
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

globalThis.toggleTesting = () => {
  globalThis.TESTING = !globalThis.TESTING
  if (globalThis.TESTING) {
    renderTesting()
  } else {
    clearWindow()
  }
}

globalThis.toggleAnimations = () => {
  globalThis.debuggingInventory = !globalThis.debuggingInventory
  globalThis.updateWin()
}

globalThis.setScale = (scale) => {
  canvasManager.setScale(scale)
}

globalThis.updateWin = () => {
  //@ts-ignore
  const selWindow = document.getElementById('active-win').value
  windowName = selWindow
  init()
}
