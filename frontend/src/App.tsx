import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Faucet from "./pages/Faucet";
import { StarknetProvider } from "./provider/starknetProvider";
import { Nabvbar } from "./components/Nabvbar";
import { useAutoConnect } from "./hooks/useAutoConnect";
import { ProtectedRoute } from "./components/ProtectedRoute";

function AppContent() {
  useAutoConnect();

  return (
    <>
      <Nabvbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faucet"
          element={
            <ProtectedRoute>
              <Faucet />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <StarknetProvider>
      <AppContent />
    </StarknetProvider>
  );
}

export default App;
