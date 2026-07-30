import BuilderSurface from './BuilderSurface';

export default function DashboardBuilder() {
  return (
    <BuilderSurface
      title="Dashboard Builder"
      description="Crea widgets solo desde resultados oficiales, con período, tendencia, comparación y snapshot."
      steps={["Plantilla","Resultado oficial","Widget","Filtros","Preview","Permisos","Publicar","Snapshot"]}
      resultCode="dashboard_builder"
      primaryHref="/bi"
    />
  );
}
