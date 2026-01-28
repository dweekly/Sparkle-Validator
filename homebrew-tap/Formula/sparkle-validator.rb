class SparkleValidator < Formula
  desc "Validate Sparkle appcast.xml feeds for macOS app updates"
  homepage "https://github.com/dweekly/Sparkle-Validator"
  url "https://registry.npmjs.org/sparkle-validator/-/sparkle-validator-1.0.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    (testpath/"test.xml").write <<~XML
      <?xml version="1.0"?>
      <rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
        <channel>
          <title>Test</title>
          <link>https://example.com</link>
          <item>
            <title>v1.0</title>
            <pubDate>Thu, 13 Jul 2023 14:30:00 -0700</pubDate>
            <sparkle:version>100</sparkle:version>
            <description>Test</description>
            <enclosure url="https://example.com/a.zip" length="1" type="application/octet-stream" sparkle:edSignature="s"/>
          </item>
        </channel>
      </rss>
    XML
    assert_match "VALID", shell_output("#{bin}/sparkle-validator #{testpath}/test.xml")
  end
end
