"use client";

import { useState } from "react";
import { Button, Card, Chip, Input, Radio, RadioGroup } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { HeroSelect } from "@/components/shared/hero-select";
import type { AssetClassification } from "@/types/prototype";

export function AddAssetScreen() {
  const [step, setStep] = useState(1);
  const [tracking, setTracking] = useState("Individual");
  const [classification, setClassification] = useState<AssetClassification>("ASSET");
  const [created, setCreated] = useState(false);
  return <AppShell pageLabel="Add asset"><div className="add-asset-screen">
    <section className="screen-intro"><p>Asset Ops · prototype</p><h1>Add new asset</h1><span>Development-only capture flow. Creation does not persist after refresh.</span></section>
    {created ? <Card className="flow-step"><Chip color="success" variant="soft">Recorded</Chip><h2>Asset created in prototype</h2><p>The local fixture flow captured the record for review only.</p></Card> : <Card className="request-flow-panel"><header><p>Step {step} of 4</p><h2>{["Basic information", "Tracking type", "Condition and documentation", "Review"][step - 1]}</h2></header>
      {step === 1 ? <div className="hero-form-grid"><label>Name<Input defaultValue="Wardah Lightbox" /></label><HeroSelect label="Classification" onChange={(value) => setClassification(value as AssetClassification)} options={[{ label: "Asset", value: "ASSET" }, { label: "Reusable Inventory", value: "INVENTORY" }]} value={classification} /><HeroSelect label="Brand" onChange={() => {}} options={["Wardah", "Make Over", "Emina", "Corporate"].map((value) => ({ label: value, value }))} value="Wardah" /><HeroSelect label="Category" onChange={() => {}} options={["Supporting asset", "Display", "POSM"].map((value) => ({ label: value, value }))} value="Supporting asset" /></div> : null}
      {step === 2 ? <div className="hero-form-grid"><RadioGroup aria-label="Tracking type" onChange={setTracking} value={tracking}><Radio value="Individual">Individually tracked</Radio><Radio value="Quantity-based">Quantity-based</Radio></RadioGroup>{tracking === "Quantity-based" ? <label>Quantity / UoM<Input defaultValue="20" type="number" /></label> : null}</div> : null}
      {step === 3 ? <div className="hero-form-grid"><HeroSelect label="Initial condition" onChange={() => {}} options={["Good", "Fair", "Poor"].map((value) => ({ label: value, value }))} value="Good" /><p>Required views: Front, Left, Right. Add clear detail evidence for issues.</p></div> : null}
      {step === 4 ? <p>Classification: {classification === "INVENTORY" ? "Reusable Inventory" : "Asset"}. Location, ownership, received date, condition, photo documentation, and existing issues will be recorded with this {tracking.toLowerCase()} physical item.</p> : null}
      <footer className="request-flow-actions"><Button isDisabled={step === 1} onPress={() => setStep((value) => value - 1)} variant="secondary">Back</Button><Button onPress={() => step === 4 ? setCreated(true) : setStep((value) => value + 1)} variant="primary">{step === 4 ? "Create asset" : "Continue"}</Button></footer>
    </Card>}
  </div></AppShell>;
}
