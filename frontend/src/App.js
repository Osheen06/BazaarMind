import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import MarketPulse from "./pages/MarketPulse";
import MarketNetwork from "./pages/MarketNetwork";
import Shop from "./pages/Shop";
import Vendor from "./pages/Vendor";
import Ask from "./pages/Ask";
import PilotBusiness from "./pages/PilotBusiness";
import More from "./pages/More";

const withShell = (el) => <Layout>{el}</Layout>;

export default function App() {
  return (
    <div className="App">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pulse" element={withShell(<MarketPulse />)} />
            <Route path="/network" element={withShell(<MarketNetwork />)} />
            <Route path="/shop" element={withShell(<Shop />)} />
            <Route path="/vendor" element={withShell(<Vendor />)} />
            <Route path="/ask" element={withShell(<Ask />)} />
            <Route path="/business" element={withShell(<PilotBusiness />)} />
            <Route path="/more" element={withShell(<More />)} />
          </Routes>
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AppProvider>
    </div>
  );
}
