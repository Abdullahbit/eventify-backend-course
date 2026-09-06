"use client";

import { useEffect, useState } from "react";

type Product = {
  id: number;
  name: string;
  stock: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch("http://localhost:3000/products");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleBuy = async (productId: number) => {
    try {
      const res = await fetch("http://localhost:3000/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to purchase");
      }

      // Refresh the product list to show the new stock
      await fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Mini <span className="text-blue-500">Inventory</span>
          </h1>
          <p className="text-gray-400">Live stock tracking & ordering</p>
        </header>

        {loading ? (
          <div className="text-center text-gray-500">Loading products...</div>
        ) : error ? (
          <div className="text-center text-red-400">Error: {error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-xl font-semibold mb-1">{product.name}</h2>
                  <div className="text-sm text-gray-400 mb-6">
                    <span
                      className={`font-medium ${
                        product.stock > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {product.stock}
                    </span>{" "}
                    in stock
                  </div>
                </div>

                <button
                  onClick={() => handleBuy(product.id)}
                  disabled={product.stock === 0}
                  className={`w-full py-2 px-4 rounded-xl font-medium transition-colors ${
                    product.stock > 0
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {product.stock > 0 ? "Buy 1" : "Out of Stock"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
