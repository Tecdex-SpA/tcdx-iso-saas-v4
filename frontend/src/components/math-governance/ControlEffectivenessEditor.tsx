import BuilderSurface from './BuilderSurface';

export default function ControlEffectivenessEditor() {
  return (
    <BuilderSurface
      title="Efectividad de controles"
      description="Configura diseño, implementación, operación, evidencia y dependencia."
      steps={["Diseño","Implementación","Operación","Evidencia","Combinación","Dependencia"]}
      resultCode="F5_5_CONTROL_EFFECTIVENESS"
      primaryHref="/controles"
    />
  );
}
