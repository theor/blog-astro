import { Plasma } from "./_pkg/sample_rust";

console.log("worker");

onmessage = (e:MessageEvent<Plasma>) => {
    console.log("Message received from main script", e);
    const plasma = Plasma.__wrap(e.data.__wbg_ptr) as Plasma;
    const update = plasma.update.bind(plasma);// `Result: ${e.data[0] * e.data[1]}`;
    const workerResult = update()
    console.log("Posting message back to main script", workerResult);
    postMessage(workerResult);
  };