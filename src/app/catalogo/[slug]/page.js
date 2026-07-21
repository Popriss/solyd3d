import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

export default async function CatalogPage({ params }) {
  const { slug } = await params;

  // Busca o catálogo e seus itens no banco de dados
  const catalog = await prisma.catalog.findUnique({
    where: { slug },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // Se não encontrar, retorna página 404
  if (!catalog) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 print:bg-white print:text-black">
      {/* Botão Flutuante (Client Component) - Oculto na Impressão */}
      <PrintButton />

      {/* Header do Catálogo */}
      <header className="p-8 text-center border-b border-gray-800 print:border-b-2 print:border-gray-200 print:pb-4">
        {/* Espaço para logo na impressão */}
        <div className="hidden print:block mb-4">
          <h2 className="text-xl font-bold text-gray-400">Solyd3D</h2>
        </div>
        
        <h1 className="text-3xl font-bold mb-2 print:text-black">{catalog.name}</h1>
        <p className="text-gray-400 print:text-gray-600">
          Catálogo selecionado de produtos
        </p>
      </header>

      {/* Grid de Produtos */}
      <main className="p-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {catalog.items.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-700 print:bg-white print:border-gray-300 print:break-inside-avoid print:shadow-none"
            >
              {/* Imagem do Produto */}
              <div className="aspect-square bg-gray-700 relative print:bg-gray-50 flex items-center justify-center">
                {item.product.imageUrl ? (
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500 print:text-gray-400 text-sm">
                    Sem imagem
                  </div>
                )}
              </div>

              {/* Detalhes do Produto */}
              <div className="p-5">
                <h2 className="text-lg font-semibold mb-2 line-clamp-2 print:text-black">
                  {item.product.name}
                </h2>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400 print:text-gray-500">
                    Preço Unitário
                  </span>
                  <span className="text-xl font-bold text-green-400 print:text-black">
                    {item.product.salePrice
                      ? new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(item.product.salePrice))
                      : "Sob consulta"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Rodapé visível apenas na impressão */}
        <footer className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
          Gerado pelo sistema Solyd3D.
        </footer>
      </main>
    </div>
  );
}
