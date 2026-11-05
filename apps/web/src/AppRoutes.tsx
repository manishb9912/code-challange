import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './layout/Layout';

// Route-level code splitting: each page is its own chunk, loaded on first visit.
const HomePage = lazy(() => import('./features/home/HomePage'));
const CategoryPage = lazy(() => import('./features/category/CategoryPage'));
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const ProductPage = lazy(() => import('./features/product/ProductPage'));
const EnquiryPage = lazy(() => import('./features/enquiry/EnquiryPage'));
const NotFoundPage = lazy(() => import('./features/not-found/NotFoundPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="product/:id/enquire" element={<EnquiryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
