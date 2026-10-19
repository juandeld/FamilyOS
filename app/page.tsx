import AccessGate from "./components/access-gate";
import FamilyApp from "./components/family-app";
export default function Page() {
  return (
    <AccessGate>
      <FamilyApp />
    </AccessGate>
  );
}
