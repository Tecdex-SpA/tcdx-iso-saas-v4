import BuilderSurface from './BuilderSurface';

export default function VariableMapper() {
  return (
    <BuilderSurface
      title="Mapeo de variables"
      description="Relaciona variables oficiales con campos permitidos del contrato fuente."
      steps={["Variable","Campo","Unidad","Normalización","Validación"]}
      resultCode="variable_mapping"
      primaryHref="/datos"
    />
  );
}
