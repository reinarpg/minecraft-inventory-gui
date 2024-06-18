//@ts-check
import { CanvasEventManager } from '../lib/CanvasManager.mjs'
import * as InventoryWindows from '../lib/inventories.mjs'
import createPwindow from './pwindow.mjs'

// todo update items
export const showInventory = (type = 'PlayerWin', getImage, itemsReactive, bot) => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    const canvasManager = new CanvasEventManager(canvas)
    const Class = InventoryWindows[type];
    const inventory = new Class(canvasManager, {
        getImage,
        getImageIcon(item) {
            return item
        }
    })
    const pwindow = createPwindow(inventory, bot)
    canvasManager.setScale(4)

    canvasManager.startRendering()
    canvasManager.children[0].callbacks

    return {
        canvasManager,
        inventory,
        pwindow,
        canvas,
        destroy() {
            canvasManager.destroy()
        }
    }
}
