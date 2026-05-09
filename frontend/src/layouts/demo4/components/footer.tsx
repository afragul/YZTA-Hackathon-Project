import { Container } from '@/components/common/container';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <Container>
        <div className="flex justify-center items-center py-5 text-sm text-muted-foreground">
          <span>
            {currentYear} &copy; Kobai Akıllı Ticaret
          </span>
        </div>
      </Container>
    </footer>
  );
}
