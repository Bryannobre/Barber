import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import PageContainer from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { companyLandingService } from "@/services/companyLanding.service";
import { LandingImageUpload } from "@/components/landing/LandingImageUpload";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";

/** Textos e imagens padrão ao criar landing (cores neutras + placeholders) */
const LOREM_HALF =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
const LOREM_SHORT = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
const PLACEHOLDER_TITLE = "Aqui você escreve um título";
const NEUTRAL_HERO = "https://placehold.co/1920x1080/e5e7eb/9ca3af?text=Imagem+de+destaque";
const NEUTRAL_IMG = (n: number) =>
  `https://placehold.co/600x600/e5e7eb/9ca3af?text=${n}`;

const ABOUT_ACCENT_OPTIONS = [
  { value: "first_word", label: "Primeira palavra" },
  { value: "last_word", label: "Última palavra" },
  { value: "all", label: "Todas as palavras" },
  { value: "none", label: "Nenhuma" },
] as const;
const ALIGN_OPTIONS = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
] as const;
const HEADING_SIZE_OPTIONS = [
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
  { value: "xl", label: "Extra grande" },
] as const;
const BODY_SIZE_OPTIONS = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Médio" },
  { value: "lg", label: "Grande" },
] as const;
const WEIGHT_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Médio" },
  { value: "semibold", label: "Semi-bold" },
  { value: "bold", label: "Bold" },
] as const;
const LETTER_SPACING_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "wide", label: "Amplo" },
  { value: "wider", label: "Mais amplo" },
] as const;
const TRANSFORM_OPTIONS = [
  { value: "none", label: "Normal" },
  { value: "uppercase", label: "MAIÚSCULAS" },
  { value: "capitalize", label: "Capitalizar" },
] as const;

const schema = z.object({
  hero_title: z.string().optional(),
  hero_subtitle: z.string().optional(),
  hero_image_url: z.string().nullable().optional(),
  about_text: z.string().optional(),
  about_image_url: z.string().nullable().optional(),
  about_title: z.string().optional(),
  about_title_accent: z.enum(["first_word", "last_word", "all", "none"]).optional().nullable(),
  about_image_1_url: z.string().nullable().optional(),
  about_image_2_url: z.string().nullable().optional(),
  about_image_3_url: z.string().nullable().optional(),
  about_image_4_url: z.string().nullable().optional(),
  gallery_image_1_url: z.string().nullable().optional(),
  gallery_image_2_url: z.string().nullable().optional(),
  gallery_image_3_url: z.string().nullable().optional(),
  gallery_image_4_url: z.string().nullable().optional(),
  gallery_image_5_url: z.string().nullable().optional(),
  gallery_image_6_url: z.string().nullable().optional(),
  gallery_image_7_url: z.string().nullable().optional(),
  gallery_image_8_url: z.string().nullable().optional(),
  cta_text: z.string().optional(),
  cta_button_text: z.string().optional(),
  hero_text_align: z.enum(["left", "center", "right"]).optional().nullable(),
  hero_title_size: z.enum(["md", "lg", "xl"]).optional().nullable(),
  hero_title_weight: z.enum(["normal", "medium", "semibold", "bold"]).optional().nullable(),
  hero_title_letter_spacing: z.enum(["normal", "wide", "wider"]).optional().nullable(),
  hero_title_transform: z.enum(["none", "uppercase", "capitalize"]).optional().nullable(),
  hero_subtitle_size: z.enum(["sm", "md", "lg"]).optional().nullable(),
  about_text_align: z.enum(["left", "center", "right"]).optional().nullable(),
  about_title_size: z.enum(["md", "lg", "xl"]).optional().nullable(),
  about_body_size: z.enum(["sm", "md", "lg"]).optional().nullable(),
  cta_text_align: z.enum(["left", "center", "right"]).optional().nullable(),
  cta_title_size: z.enum(["md", "lg", "xl"]).optional().nullable(),
  cta_body_size: z.enum(["sm", "md", "lg"]).optional().nullable(),
  cta_button_text_size: z.enum(["sm", "md", "lg"]).optional().nullable(),
  primary_color: z.string().optional(),
  secondary_color: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LandingSettings() {
  const { currentCompany } = useTenant();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id ?? "";
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current = document.querySelector("main");
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
    return () => {
      mainRef.current = null;
    };
  }, []);

  const { data: settingsData } = useQuery({
    queryKey: ["company-landing-settings", companyId],
    queryFn: () => companyLandingService.getByCompanyId(companyId),
    enabled: !!companyId,
  });

  const settings = settingsData?.data ?? null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      hero_title: "",
      hero_subtitle: "",
      hero_image_url: null,
      about_text: "",
      about_image_url: null,
      about_title: "",
      about_title_accent: "last_word",
      about_image_1_url: null,
      about_image_2_url: null,
      about_image_3_url: null,
      about_image_4_url: null,
      gallery_image_1_url: null,
      gallery_image_2_url: null,
      gallery_image_3_url: null,
      gallery_image_4_url: null,
      gallery_image_5_url: null,
      gallery_image_6_url: null,
      gallery_image_7_url: null,
      gallery_image_8_url: null,
      cta_text: "",
      cta_button_text: "",
      hero_text_align: "center",
      hero_title_size: "lg",
      hero_title_weight: "bold",
      hero_title_letter_spacing: "normal",
      hero_title_transform: "none",
      hero_subtitle_size: "md",
      about_text_align: "center",
      about_title_size: "lg",
      about_body_size: "md",
      cta_text_align: "center",
      cta_title_size: "lg",
      cta_body_size: "md",
      cta_button_text_size: "md",
      primary_color: "",
      secondary_color: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        hero_title: settings.hero_title ?? "",
        hero_subtitle: settings.hero_subtitle ?? "",
        hero_image_url: settings.hero_image_url,
        about_text: settings.about_text ?? "",
        about_image_url: settings.about_image_url,
        about_title: settings.about_title ?? "",
        about_title_accent: settings.about_title_accent ?? "last_word",
        about_image_1_url: settings.about_image_1_url ?? null,
        about_image_2_url: settings.about_image_2_url ?? null,
        about_image_3_url: settings.about_image_3_url ?? null,
        about_image_4_url: settings.about_image_4_url ?? null,
        gallery_image_1_url: settings.gallery_image_1_url ?? null,
        gallery_image_2_url: settings.gallery_image_2_url ?? null,
        gallery_image_3_url: settings.gallery_image_3_url ?? null,
        gallery_image_4_url: settings.gallery_image_4_url ?? null,
        gallery_image_5_url: settings.gallery_image_5_url ?? null,
        gallery_image_6_url: settings.gallery_image_6_url ?? null,
        gallery_image_7_url: settings.gallery_image_7_url ?? null,
        gallery_image_8_url: settings.gallery_image_8_url ?? null,
        cta_text: settings.cta_text ?? "",
        cta_button_text: settings.cta_button_text ?? "",
        hero_text_align: settings.hero_text_align ?? "center",
        hero_title_size: settings.hero_title_size ?? "lg",
        hero_title_weight: settings.hero_title_weight ?? "bold",
        hero_title_letter_spacing: settings.hero_title_letter_spacing ?? "normal",
        hero_title_transform: settings.hero_title_transform ?? "none",
        hero_subtitle_size: settings.hero_subtitle_size ?? "md",
        about_text_align: settings.about_text_align ?? "center",
        about_title_size: settings.about_title_size ?? "lg",
        about_body_size: settings.about_body_size ?? "md",
        cta_text_align: settings.cta_text_align ?? "center",
        cta_title_size: settings.cta_title_size ?? "lg",
        cta_body_size: settings.cta_body_size ?? "md",
        cta_button_text_size: settings.cta_button_text_size ?? "md",
        primary_color: settings.primary_color ?? "",
        secondary_color: settings.secondary_color ?? "",
      });
    } else if (currentCompany) {
      form.reset({
        hero_title: PLACEHOLDER_TITLE,
        hero_subtitle: LOREM_HALF,
        hero_image_url: NEUTRAL_HERO,
        about_text: LOREM_HALF,
        about_image_url: NEUTRAL_IMG(0),
        about_title: PLACEHOLDER_TITLE,
        about_title_accent: "last_word",
        about_image_1_url: NEUTRAL_IMG(1),
        about_image_2_url: NEUTRAL_IMG(2),
        about_image_3_url: NEUTRAL_IMG(3),
        about_image_4_url: NEUTRAL_IMG(4),
        gallery_image_1_url: NEUTRAL_IMG(1),
        gallery_image_2_url: NEUTRAL_IMG(2),
        gallery_image_3_url: NEUTRAL_IMG(3),
        gallery_image_4_url: NEUTRAL_IMG(4),
        gallery_image_5_url: NEUTRAL_IMG(5),
        gallery_image_6_url: NEUTRAL_IMG(6),
        gallery_image_7_url: NEUTRAL_IMG(7),
        gallery_image_8_url: NEUTRAL_IMG(8),
        cta_text: LOREM_SHORT,
        cta_button_text: "Agendar agora",
        hero_text_align: "center",
        hero_title_size: "lg",
        hero_title_weight: "bold",
        hero_title_letter_spacing: "normal",
        hero_title_transform: "none",
        hero_subtitle_size: "md",
        about_text_align: "center",
        about_title_size: "lg",
        about_body_size: "md",
        cta_text_align: "center",
        cta_title_size: "lg",
        cta_body_size: "md",
        cta_button_text_size: "md",
        primary_color: "",
        secondary_color: "",
      });
    }
  }, [settings, currentCompany, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await companyLandingService.upsertLandingSettings(
        companyId,
        {
          hero_title: values.hero_title || null,
          hero_subtitle: values.hero_subtitle || null,
          hero_image_url: values.hero_image_url || null,
          about_text: values.about_text || null,
          about_image_url: values.about_image_url || null,
          about_title: values.about_title || null,
          about_title_accent: values.about_title_accent || null,
          about_image_1_url: values.about_image_1_url || null,
          about_image_2_url: values.about_image_2_url || null,
          about_image_3_url: values.about_image_3_url || null,
          about_image_4_url: values.about_image_4_url || null,
          gallery_image_1_url: values.gallery_image_1_url || null,
          gallery_image_2_url: values.gallery_image_2_url || null,
          gallery_image_3_url: values.gallery_image_3_url || null,
          gallery_image_4_url: values.gallery_image_4_url || null,
          gallery_image_5_url: values.gallery_image_5_url || null,
          gallery_image_6_url: values.gallery_image_6_url || null,
          gallery_image_7_url: values.gallery_image_7_url || null,
          gallery_image_8_url: values.gallery_image_8_url || null,
          cta_text: values.cta_text || null,
          cta_button_text: values.cta_button_text || null,
          hero_text_align: values.hero_text_align || null,
          hero_title_size: values.hero_title_size || null,
          hero_title_weight: values.hero_title_weight || null,
          hero_title_letter_spacing: values.hero_title_letter_spacing || null,
          hero_title_transform: values.hero_title_transform || null,
          hero_subtitle_size: values.hero_subtitle_size || null,
          about_text_align: values.about_text_align || null,
          about_title_size: values.about_title_size || null,
          about_body_size: values.about_body_size || null,
          cta_text_align: values.cta_text_align || null,
          cta_title_size: values.cta_title_size || null,
          cta_body_size: values.cta_body_size || null,
          cta_button_text_size: values.cta_button_text_size || null,
          primary_color: values.primary_color || null,
          secondary_color: values.secondary_color || null,
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-landing-settings", companyId] });
      toast.success("Configurações da landing salvas.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    },
  });

  const landingUrl =
    typeof window !== "undefined" && currentCompany?.slug
      ? `${window.location.origin}/site/${currentCompany.slug}`
      : null;

  const copyLandingUrl = () => {
    if (!landingUrl) return;
    void navigator.clipboard.writeText(landingUrl);
    toast.success("Link copiado para a área de transferência.");
  };

  const openLanding = () => {
    if (landingUrl) window.open(landingUrl, "_blank", "noopener,noreferrer");
  };

  if (!currentCompany) {
    return (
      <PageContainer>
        <p className="text-muted-foreground">Selecione uma empresa para continuar.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      actions={
        <Link to="/app/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Voltar
          </Button>
        </Link>
      }
    >
      <div className="space-y-8 min-w-0 max-w-full">
        {/* URL da landing */}
        <Card>
          <CardHeader>
            <CardTitle>URL da sua landing</CardTitle>
            <CardDescription>
              Compartilhe este link com seus clientes: /site/{currentCompany.slug}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                readOnly
                value={landingUrl ?? ""}
                className="font-mono text-sm bg-muted/50"
              />
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="icon" onClick={copyLandingUrl} title="Copiar link">
                  <Copy size={18} />
                </Button>
                <Button onClick={openLanding} className="gap-2">
                  <ExternalLink size={18} />
                  Abrir landing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
            className="space-y-8"
          >
            {/* Hero */}
            <Card>
              <CardHeader>
                <CardTitle>Hero</CardTitle>
                <CardDescription>
                  Título, subtítulo e imagem de destaque da seção principal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="hero_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder={PLACEHOLDER_TITLE} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hero_subtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtítulo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={LOREM_SHORT}
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hero_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imagem de fundo</FormLabel>
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                        <p>
                          Formato recomendado: <span className="font-medium text-foreground">retangular 16:9</span>.
                        </p>
                        <p>
                          Tamanho ideal: <span className="font-medium text-foreground">1920x1080</span> (mínimo 1280x720).
                        </p>
                        <p>
                          Para melhor desempenho, prefira JPG/WebP otimizado (ex.: até ~600 KB).
                        </p>
                      </div>
                      <FormControl>
                        <LandingImageUpload
                          companyId={companyId}
                          path="hero"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Sobre */}
            <Card>
              <CardHeader>
                <CardTitle>Sobre</CardTitle>
                <CardDescription>
                  Título, texto e imagens da seção sobre a empresa (4 imagens em grid 2x2)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="about_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título da seção</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={PLACEHOLDER_TITLE}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="about_title_accent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destaque no título (cor primária)</FormLabel>
                      <Select
                        value={field.value ?? "last_word"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha onde aplicar a cor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ABOUT_ACCENT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="about_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto descritivo</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={LOREM_HALF}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-3">
                  <FormLabel>Imagens da galeria (posições 1 a 4)</FormLabel>
                  <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                    <p>
                      Formato recomendado: <span className="font-medium text-foreground">retangular 4:3</span>.
                    </p>
                    <p>
                      Tamanho ideal: <span className="font-medium text-foreground">1200x900</span> (mínimo 800x600).
                    </p>
                    <p>
                      Para melhor desempenho, prefira JPG/WebP otimizado (ex.: até ~500 KB por imagem).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(
                      [
                        { name: "about_image_1_url" as const, path: "about_1" as const, label: "Imagem 1 (superior esquerda)" },
                        { name: "about_image_2_url" as const, path: "about_2" as const, label: "Imagem 2 (superior direita)" },
                        { name: "about_image_3_url" as const, path: "about_3" as const, label: "Imagem 3 (inferior esquerda)" },
                        { name: "about_image_4_url" as const, path: "about_4" as const, label: "Imagem 4 (inferior direita)" },
                      ] as const
                    ).map(({ name, path, label }) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-muted-foreground font-normal">
                              {label}
                            </FormLabel>
                            <FormControl>
                              <LandingImageUpload
                                companyId={companyId}
                                path={path}
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Galeria - Nossos Trabalhos */}
            <Card>
              <CardHeader>
                <CardTitle>Nossos Trabalhos (Galeria)</CardTitle>
                <CardDescription>
                  Fotos exibidas na seção "Nossos Trabalhos" da landing (8 posições em grid)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    Formato recomendado: <span className="font-medium text-foreground">quadrado (1:1)</span>.
                  </p>
                  <p>
                    Tamanho ideal: <span className="font-medium text-foreground">1080x1080</span> (mínimo 400x400).
                  </p>
                  <p>
                    Para melhor desempenho, prefira JPG/WebP otimizado (ex.: até ~400 KB por imagem).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(
                    [
                      { name: "gallery_image_1_url" as const, path: "gallery_1" as const },
                      { name: "gallery_image_2_url" as const, path: "gallery_2" as const },
                      { name: "gallery_image_3_url" as const, path: "gallery_3" as const },
                      { name: "gallery_image_4_url" as const, path: "gallery_4" as const },
                      { name: "gallery_image_5_url" as const, path: "gallery_5" as const },
                      { name: "gallery_image_6_url" as const, path: "gallery_6" as const },
                      { name: "gallery_image_7_url" as const, path: "gallery_7" as const },
                      { name: "gallery_image_8_url" as const, path: "gallery_8" as const },
                    ] as const
                  ).map(({ name, path }, i) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground font-normal">
                            Trabalho {i + 1}
                          </FormLabel>
                          <FormControl>
                            <LandingImageUpload
                              companyId={companyId}
                              path={path}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* CTA */}
            <Card>
              <CardHeader>
                <CardTitle>CTA (Call to Action)</CardTitle>
                <CardDescription>Texto e botão da seção final</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="cta_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto</FormLabel>
                      <FormControl>
                        <Input placeholder={LOREM_SHORT} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cta_button_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto do botão</FormLabel>
                      <FormControl>
                        <Input placeholder="Agendar agora" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Separator />

            {/* Tipografia e formatação */}
            <Card>
              <CardHeader>
                <CardTitle>Tipografia e formatação</CardTitle>
                <CardDescription>
                  Controle de tamanho, peso e alinhamento dos textos na landing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Hero</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="hero_text_align"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alinhamento</FormLabel>
                          <Select value={field.value ?? "center"} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ALIGN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hero_title_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do título</FormLabel>
                          <Select value={field.value ?? "lg"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {HEADING_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hero_subtitle_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do subtítulo</FormLabel>
                          <Select value={field.value ?? "md"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {BODY_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hero_title_weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso do título</FormLabel>
                          <Select value={field.value ?? "bold"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {WEIGHT_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hero_title_letter_spacing"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Espaçamento entre letras</FormLabel>
                          <Select value={field.value ?? "normal"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {LETTER_SPACING_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hero_title_transform"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transformação do título</FormLabel>
                          <Select value={field.value ?? "none"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {TRANSFORM_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Sobre</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="about_text_align"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alinhamento</FormLabel>
                          <Select value={field.value ?? "center"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {ALIGN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="about_title_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do título</FormLabel>
                          <Select value={field.value ?? "lg"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {HEADING_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="about_body_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do texto</FormLabel>
                          <Select value={field.value ?? "md"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {BODY_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">CTA</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="cta_text_align"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alinhamento</FormLabel>
                          <Select value={field.value ?? "center"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {ALIGN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cta_title_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do título</FormLabel>
                          <Select value={field.value ?? "lg"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {HEADING_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cta_body_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do texto</FormLabel>
                          <Select value={field.value ?? "md"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {BODY_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cta_button_text_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tamanho do texto do botão</FormLabel>
                          <Select value={field.value ?? "md"} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {BODY_SIZE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Tema */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle>Tema</CardTitle>
                <CardDescription>Cores primária e secundária da landing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-45 pointer-events-none select-none">
                  <FormField
                    control={form.control}
                    name="primary_color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor primária</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={field.value || "#6fcf97"}
                              onChange={field.onChange}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="#6fcf97"
                              className="flex-1 font-mono"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="secondary_color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor secundária</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={field.value || "#4ade80"}
                              onChange={field.onChange}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              placeholder="#4ade80"
                              className="flex-1 font-mono"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] pointer-events-none">
                <span className="rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                  Em construção
                </span>
              </div>
            </Card>

            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </Form>
      </div>
    </PageContainer>
  );
}
