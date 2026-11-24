import { describe, expect, test } from "bun:test"
import {
  emptyGalleryQueue,
  markTimedOut,
  nextBackgroundUrl,
  pendingUrls,
  startUrls,
} from "./_gallery-queue"

const order = ["a", "b", "c", "d", "e"]
const none = () => false

describe("gallery queue", () => {
  test("starts with the first url in gallery order", () => {
    expect(nextBackgroundUrl(order, emptyGalleryQueue("s"), none)).toBe("a")
  })

  test("waits while a started request is undecided", () => {
    const state = startUrls(emptyGalleryQueue("s"), "s", ["a"])
    expect(nextBackgroundUrl(order, state, none)).toBeNull()
  })

  test("moves on after a final error", () => {
    const state = startUrls(emptyGalleryQueue("s"), "s", ["a"])
    expect(nextBackgroundUrl(order, state, url => url === "a")).toBe("b")
  })

  test("moves on after a timeout without treating the url as done", () => {
    let state = startUrls(emptyGalleryQueue("s"), "s", ["a"])
    state = markTimedOut(state, "s", "a")
    expect(nextBackgroundUrl(order, state, none)).toBe("b")
    expect(state.started.has("a")).toBe(true)
  })

  test("a jump to the last item does not start a second background request", () => {
    const state = startUrls(startUrls(emptyGalleryQueue("s"), "s", ["a"]), "s", ["e"])
    expect(pendingUrls(order, state, none)).toEqual(["a", "e"])
    expect(nextBackgroundUrl(order, state, none)).toBeNull()
  })

  test("skips urls that are already loaded", () => {
    const done = (url: string) => url === "a" || url === "b"
    expect(nextBackgroundUrl(order, emptyGalleryQueue("s"), done)).toBe("c")
  })

  test("returns null when everything is decided", () => {
    expect(nextBackgroundUrl(order, emptyGalleryQueue("s"), () => true)).toBeNull()
  })

  test("late timer from a previous product is ignored", () => {
    const old = startUrls(emptyGalleryQueue("old"), "old", ["a"])
    const next = startUrls(old, "new", ["x"])
    expect(next.scope).toBe("new")
    expect(markTimedOut(next, "old", "x")).toBe(next)
    expect(next.timedOut.size).toBe(0)
  })
})
