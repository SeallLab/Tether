#!/usr/bin/env python3
"""
PDF Indexing Script for RAG Pipeline
Loads PDFs from the ../rag/pdfs directory and creates a vector store
"""

import os
import sys
import pickle
from pathlib import Path
from typing import List

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document


class PDFIndexer:
    def __init__(self, google_api_key: str = None):
        """Initialize the PDF indexer with Google API key"""
        if google_api_key:
            os.environ["GOOGLE_API_KEY"] = google_api_key
        elif not os.environ.get("GOOGLE_API_KEY"):
            raise ValueError(
                "Google API key must be provided either as parameter or environment variable")

        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001")
        self.vector_store = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )

    def load_pdfs(self, pdf_directory: str = "../rag/pdfs") -> List[Document]:
        """Load all PDFs from the specified directory"""
        pdf_path = Path(pdf_directory)
        if not pdf_path.exists():
            raise FileNotFoundError(
                f"PDF directory not found: {pdf_directory}")

        all_docs = []
        pdf_files = list(pdf_path.glob("*.pdf"))

        if not pdf_files:
            print(f"No PDF files found in {pdf_directory}")
            return all_docs

        print(f"Found {len(pdf_files)} PDF files to process...")

        for pdf_file in pdf_files:
            print(f"Processing: {pdf_file.name}")
            try:
                loader = PyPDFLoader(str(pdf_file))
                docs = loader.load()
                all_docs.extend(docs)
                print(f"  - Loaded {len(docs)} pages")
            except Exception as e:
                print(f"  - Error loading {pdf_file.name}: {e}")

        return all_docs

    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks"""
        print(f"Splitting {len(documents)} documents into chunks...")
        splits = self.text_splitter.split_documents(documents)
        print(f"Created {len(splits)} chunks")
        return splits

    def index_documents(self, documents: List[Document]):
        """Add documents to the vector store"""
        print(f"Indexing {len(documents)} document chunks...")
        self.vector_store = FAISS.from_documents(
            documents=documents, embedding=self.embeddings)
        print("Indexing complete!")

    def save_vector_store(self, file_path: str = "vector_store.pkl"):
        """Save the vector store to disk"""
        if self.vector_store is None:
            raise ValueError(
                "Vector store not initialized. Call index_documents first.")

        print(f"Saving vector store to {file_path}...")
        # Use FAISS native save method instead of pickle
        base_path = file_path.replace('.pkl', '')
        self.vector_store.save_local(base_path)
        print(f"Vector store saved to {base_path}/")

    def load_vector_store(self, file_path: str = "vector_store"):
        """Load vector store from disk"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(
                f"Vector store directory not found: {file_path}")

        print(f"Loading vector store from {file_path}...")
        self.vector_store = FAISS.load_local(
            file_path, self.embeddings, allow_dangerous_deserialization=True)
        print("Vector store loaded!")

    def process_all(self, pdf_directory: str = "../rag/pdfs", save_path: str = "vector_store"):
        """Complete pipeline: load, split, index, and save"""
        # Load PDFs
        documents = self.load_pdfs(pdf_directory)
        if not documents:
            print("No documents to process!")
            return

        # Split into chunks
        splits = self.split_documents(documents)

        # Index documents
        self.index_documents(splits)

        # Save vector store
        self.save_vector_store(save_path)

        print(
            f"Successfully processed {len(documents)} documents into {len(splits)} chunks")


def main():
    """Main function to run the indexing process"""
    import argparse

    parser = argparse.ArgumentParser(description="Index PDFs for RAG pipeline")
    parser.add_argument("--pdf-dir", default="../rag/pdfs",
                        help="Directory containing PDF files")
    parser.add_argument("--output", default="vector_store",
                        help="Output directory for vector store")
    parser.add_argument(
        "--api-key", help="Google API key (or set GOOGLE_API_KEY env var)")

    args = parser.parse_args()

    try:
        indexer = PDFIndexer(google_api_key=args.api_key)
        indexer.process_all(pdf_directory=args.pdf_dir, save_path=args.output)
        print("PDF indexing completed successfully!")
    except Exception as e:
        print(f"Error during indexing: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
