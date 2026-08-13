import assert from "node:assert/strict";
import { decideNextStep, errorGroup } from "../src/nonprofit-error-capture.ts";

assert.equal(decideNextStep("donor_receipt"), "retry");
assert.equal(decideNextStep("volunteer_reminder"), "retry");
assert.equal(decideNextStep("campaign_reporting"), "review");
assert.deepEqual(errorGroup("donor_receipt", "send_receipt"), ["nonprofit", "donor_receipt", "send_receipt"]);
console.log("nonprofit error decision test passed");
