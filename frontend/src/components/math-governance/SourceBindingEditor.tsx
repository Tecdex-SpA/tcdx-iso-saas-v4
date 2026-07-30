import BuilderSurface from './BuilderSurface';

export default function SourceBindingEditor() {
  return (
    <BuilderSurface
      title="Source binding"
      description="Mapea variables a source contracts permitidos y tenant-scoped."
      steps={["Seleccionar fuente","Mapear variable","Validar tenant","Validar cobertura","Guardar binding"]}
      resultCode="source_binding"
      primaryHref="/datos"
    />
  );
}
