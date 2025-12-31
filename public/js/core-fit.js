(() => {
  const gameCanvas = document.getElementById("game");
  const gameWrap = document.getElementById("game-wrap");
  const mapStage = document.getElementById("mapStage");

  if (!gameCanvas || !gameWrap || !mapStage) {
    return;
  }

  let lastWidth = 0;
  let lastHeight = 0;

  function fitCanvas() {
    const stageWidth = mapStage.clientWidth;
    const stageHeight = mapStage.clientHeight;
    const intrinsicWidth = gameCanvas.width;
    const intrinsicHeight = gameCanvas.height;

    if (!stageWidth || !stageHeight || !intrinsicWidth || !intrinsicHeight) {
      return;
    }

    const scale = Math.min(stageWidth / intrinsicWidth, stageHeight / intrinsicHeight);
    const displayWidth = Math.max(1, Math.floor(intrinsicWidth * scale));
    const displayHeight = Math.max(1, Math.floor(intrinsicHeight * scale));

    if (displayWidth === lastWidth && displayHeight === lastHeight) {
      return;
    }

    lastWidth = displayWidth;
    lastHeight = displayHeight;

    gameWrap.style.width = `${displayWidth}px`;
    gameWrap.style.height = `${displayHeight}px`;
    gameCanvas.style.width = `${displayWidth}px`;
    gameCanvas.style.height = `${displayHeight}px`;
  }

  if (typeof ResizeObserver === "function") {
    const resizeObserver = new ResizeObserver(fitCanvas);
    resizeObserver.observe(mapStage);
  }

  if (typeof MutationObserver === "function") {
    const attrObserver = new MutationObserver(fitCanvas);
    attrObserver.observe(gameCanvas, { attributes: true, attributeFilter: ["width", "height"] });
  }

  window.addEventListener("resize", fitCanvas);
  window.addEventListener("load", fitCanvas);
  requestAnimationFrame(fitCanvas);
})();
