"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function SearchBar({
  placeholder = "Search all available services",
  defaultValue = "",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        name="query"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full h-14 pl-6 pr-16 rounded-full border-2 border-[#00803E]/30 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#00803E] transition-colors text-base"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#00803E] hover:bg-[#006a33] rounded-full flex items-center justify-center transition-colors"
      >
        <Search className="w-5 h-5 text-white" />
      </button>
    </form>
  );
}
