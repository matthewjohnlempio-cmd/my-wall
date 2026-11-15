
"use client";

import { useEffect, useState } from "react";

import type { ChangeEvent } from "react";

import { supabase } from "@/lib/supabase";

type Post = {
  id: number;
  name: string;
  message: string;
  created_at: string;
  image_url: string | null;
};

export default function Home() {
  const [message, setMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const profileName = "Matthew Lempio";

  // Add a post without creating duplicates
  function addPost(post: Post) {
    setPosts((current) => [
      post,
      ...current.filter((item) => item.id !== post.id),
    ]);
  }

  // Format post timestamp
  function formatTime(date: string) {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Fetch posts and subscribe to Realtime
  useEffect(() => {
    async function fetchPosts() {
      const { data, error } = await supabase
        .from("posts")
        .select("id, name, message, created_at, image_url")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setError("Unable to load posts. Please try again.");
      } else {
        setPosts(data || []);
      }

      setLoading(false);
    }

    fetchPosts();

    const channel = supabase
      .channel("wall-posts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
        },
        (payload) => {
          addPost(payload.new as Post);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Handle image selection
  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    setError("");

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // Remove selected image
  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(null);
    setImagePreview("");

    const fileInput = document.getElementById(
      "wall-photo"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }
  }

  // Publish a new post
  async function handleShare() {
    if ((!message.trim() && !selectedImage) || sharing) return;

    setSharing(true);
    setError("");

    try {
      let imageUrl: string | null = null;

      // Upload image to Supabase Storage
      if (selectedImage) {
        const fileExtension =
          selectedImage.name.split(".").pop() || "jpg";

        const filePath = `posts/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("wall-photos")
          .upload(filePath, selectedImage, {
            cacheControl: "3600",
            contentType: selectedImage.type,
            upsert: false,
          });

        if (uploadError) {
          setError("Failed to upload photo. Please try again.");
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("wall-photos")
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      // Save post to Supabase using Matthew's name
      const { data, error: insertError } = await supabase
        .from("posts")
        .insert([
          {
            name: profileName,
            message: message.trim(),
            image_url: imageUrl,
          },
        ])
        .select("id, name, message, created_at, image_url")
        .single();

      if (insertError) {
        setError("Failed to publish your post. Please try again.");
        return;
      }

      addPost(data);
      setMessage("");
      removeImage();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#e9edf5] text-[#333]">

      {/* Navigation */}
      <nav className="bg-[#3b5998] text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Wall
          </h1>

          <div className="text-sm font-medium">
            {profileName}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">

        {/* Profile Header */}
        <section className="mb-5 rounded-sm border border-[#c4cde0] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            <img
              src="/profile.png"
              alt="Matthew's profile"
              className="h-32 w-32 shrink-0 border border-[#ccd4e0] bg-[#edf1f7] object-cover"
            />

            <div>
              <h2 className="text-2xl font-bold text-[#3b5998]">
                {profileName}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Software Developer
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Cebu, Philippines
              </p>
            </div>

          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr]">

          {/* Information Sidebar */}
          <aside>
            <section className="border border-[#c4cde0] bg-white p-4 shadow-sm">
              <h3 className="mb-3 border-b border-gray-200 pb-2 font-bold text-[#3b5998]">
                Information
              </h3>

              <div className="space-y-3 text-sm">
                <p>👤 Software Developer</p>
                <p>📍 Cebu, Philippines</p>
                <p>💻 Interested in Technology</p>
                <p>🎮 Game Development</p>
              </div>
            </section>
          </aside>

          {/* Wall */}
          <section>

            {/* Composer */}
            <div className="mb-5 border border-[#c4cde0] bg-white p-4 shadow-sm">

              <h3 className="mb-3 border-b border-gray-200 pb-2 font-bold text-[#3b5998]">
                Write on Matthew&apos;s Wall
              </h3>

              <textarea
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value.slice(0, 280))
                }
                placeholder="Write something..."
                maxLength={280}
                rows={3}
                className="w-full resize-none border border-[#bdc7d8] bg-white p-3 text-sm outline-none focus:border-[#3b5998]"
              />

              {/* Photo Picker */}
              <div className="mt-3">
                <label
                  htmlFor="wall-photo"
                  className="inline-block cursor-pointer border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-[#3b5998] hover:bg-gray-200"
                >
                  📷 Add Photo
                </label>

                <input
                  id="wall-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {/* Image Preview */}
                {imagePreview && (
                  <div className="mt-3">
                    <img
                      src={imagePreview}
                      alt="Photo preview"
                      className="max-h-64 max-w-full border border-gray-200 object-contain"
                    />

                    <button
                      type="button"
                      onClick={removeImage}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {/* Share Button */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {message.length}/280 characters
                </span>

                <button
                  onClick={handleShare}
                  disabled={
                    (!message.trim() && !selectedImage) || sharing
                  }
                  className="bg-[#5b74a8] px-5 py-2 text-sm font-semibold text-white hover:bg-[#496397] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sharing ? "Sharing..." : "Share"}
                </button>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-600">
                  {error}
                </p>
              )}

            </div>

            {/* Wall Feed */}
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-[#3b5998]">
                Matthew&apos;s Wall
              </h3>

              <span className="text-xs text-gray-500">
                {posts.length} posts
              </span>
            </div>

            <div className="space-y-3">

              {loading ? (
                <div className="border border-[#c4cde0] bg-white p-6 text-center text-sm text-gray-500">
                  Loading posts...
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-[#c4cde0] bg-white p-6 text-center text-sm text-gray-500">
                  No posts yet. Be the first to write something!
                </div>
              ) : (
                posts.map((post) => (
                  <article
                    key={post.id}
                    className="border border-[#c4cde0] bg-white p-4 shadow-sm"
                  >

                    {/* Poster Name */}
                    <p className="font-bold text-[#3b5998]">
                      {post.name}
                    </p>

                    {/* Post Date */}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatTime(post.created_at)}
                    </p>

                    {/* Post Message */}
                    {post.message && (
                      <p className="mt-3 break-words text-sm leading-relaxed text-gray-700">
                        {post.message}
                      </p>
                    )}

                    {/* Uploaded Photo */}
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Post attachment"
                        className="mt-3 max-h-96 max-w-full border border-gray-200 object-contain"
                      />
                    )}

                  </article>
                ))
              )}

            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-[#c4cde0] py-5 text-center text-xs text-gray-400">
          My Wall © 2026 · A little nostalgia from 2008–2009
        </footer>

      </div>
    </main>
  );
}
