(() => {
  const root = "/core";
  window.CORE_CONFIG = Object.assign({}, window.CORE_CONFIG, {
    assetsRoot: root,
    mapsFolder: `${root}/mapas`,
    pokefireredRoot: `${root}/pokefirered-master/pokefirered-master`,
  });
})();
