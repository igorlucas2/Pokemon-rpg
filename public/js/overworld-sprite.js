(() => {
  const select = document.getElementById("overworldSpriteSelect");
  const status = document.getElementById("overworldSpriteStatus");
  if (!select) return;

  async function postJson(url, bodyObj) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(bodyObj || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.error || "failed"), { status: res.status, data });
    return data;
  }

  select.addEventListener("change", async () => {
    const spriteId = String(select.value || "").trim();
    if (!spriteId) return;

    try {
      if (status) status.textContent = "Salvando...";
      await postJson("/api/trainer/overworld-sprite", { spriteId });
      if (status) status.textContent = "Salvo. Recarregando...";
      window.location.reload();
    } catch (err) {
      if (status) status.textContent = `Erro ao salvar: ${err?.data?.error || err?.message || "failed"}`;
    }
  });
})();
