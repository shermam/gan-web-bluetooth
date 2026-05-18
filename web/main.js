import { connectGanCube } from "../src/index.js";

document.querySelector("button")?.addEventListener("click", async () => {
  const conn = await connectGanCube();

  conn.events$.subscribe((event) => {
    if (event.type == "FACELETS") {
      console.log("Cube facelets state", event.facelets);
    } else if (event.type == "MOVE") {
      console.log("Cube move", event.move);
    }
  });

  await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
});
