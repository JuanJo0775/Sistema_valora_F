import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs, type TabItem } from './Tabs';

const items: TabItem[] = [
  { id: 'uno', label: 'Uno', content: <p>Contenido uno</p> },
  { id: 'dos', label: 'Dos', content: <p>Contenido dos</p> },
  { id: 'tres', label: 'Tres', content: <p>Contenido tres</p> },
];

function Harness({ tabs = items }: { tabs?: TabItem[] }) {
  const [value, setValue] = useState('uno');
  return <Tabs label="Secciones" tabs={tabs} value={value} onChange={setValue} />;
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('pestañas accesibles', () => {
  it('es un tablist con nombre, pestañas con aria-selected y un panel por pestaña', () => {
    render(<Harness />);

    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(tab('Uno')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Dos')).toHaveAttribute('aria-selected', 'false');
    const panel = screen.getByRole('tabpanel', { name: 'Uno' });
    expect(panel).toHaveTextContent('Contenido uno');
    expect(tab('Uno')).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tab('Uno').id);
    expect(screen.queryByText('Contenido dos')).not.toBeInTheDocument();
  });

  it('cada pestaña apunta a un panel que existe, aunque esté oculto', () => {
    const { container } = render(<Harness />);

    for (const element of screen.getAllByRole('tab')) {
      const panel = container.querySelector(`[id="${element.getAttribute('aria-controls') ?? ''}"]`);
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', element.id);
    }
  });

  it('solo la pestaña activa está en el orden de Tab', () => {
    render(<Harness />);

    expect(tab('Uno')).toHaveAttribute('tabindex', '0');
    expect(tab('Dos')).toHaveAttribute('tabindex', '-1');
    expect(tab('Tres')).toHaveAttribute('tabindex', '-1');
    fireEvent.click(tab('Dos'));
    expect(tab('Uno')).toHaveAttribute('tabindex', '-1');
    expect(tab('Dos')).toHaveAttribute('tabindex', '0');
  });

  it('la flecha derecha activa y enfoca la siguiente; al final vuelve a la primera', () => {
    render(<Harness />);
    tab('Uno').focus();

    fireEvent.keyDown(tab('Uno'), { key: 'ArrowRight' });
    expect(tab('Dos')).toHaveFocus();
    expect(tab('Dos')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Contenido dos')).toBeInTheDocument();

    fireEvent.keyDown(tab('Dos'), { key: 'ArrowRight' });
    fireEvent.keyDown(tab('Tres'), { key: 'ArrowRight' });
    expect(tab('Uno')).toHaveFocus();
    expect(tab('Uno')).toHaveAttribute('aria-selected', 'true');
  });

  it('la flecha izquierda retrocede; desde la primera salta a la última', () => {
    render(<Harness />);
    tab('Uno').focus();

    fireEvent.keyDown(tab('Uno'), { key: 'ArrowLeft' });
    expect(tab('Tres')).toHaveFocus();
    expect(tab('Tres')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('Tres'), { key: 'ArrowLeft' });
    expect(tab('Dos')).toHaveFocus();
  });

  it('Inicio y Fin llevan a la primera y a la última', () => {
    render(<Harness />);
    tab('Uno').focus();

    fireEvent.keyDown(tab('Uno'), { key: 'End' });
    expect(tab('Tres')).toHaveFocus();
    expect(tab('Tres')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('Tres'), { key: 'Home' });
    expect(tab('Uno')).toHaveFocus();
    expect(tab('Uno')).toHaveAttribute('aria-selected', 'true');
  });

  it('un clic activa la pestaña y esta conserva el foco', () => {
    render(<Harness />);
    tab('Dos').focus();

    fireEvent.click(tab('Dos'));

    expect(tab('Dos')).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Dos' })).toHaveTextContent('Contenido dos');
  });

  it('ignora las demás teclas', () => {
    render(<Harness />);
    tab('Uno').focus();

    fireEvent.keyDown(tab('Uno'), { key: 'ArrowDown' });
    fireEvent.keyDown(tab('Uno'), { key: 'a' });

    expect(tab('Uno')).toHaveFocus();
    expect(tab('Uno')).toHaveAttribute('aria-selected', 'true');
  });

  it('un panel marcado keepMounted conserva su contenido, oculto, al cambiar de pestaña', () => {
    render(
      <Harness
        tabs={[
          { ...items[0], keepMounted: true } as TabItem,
          items[1] as TabItem,
          items[2] as TabItem,
        ]}
      />,
    );

    fireEvent.click(tab('Dos'));

    expect(screen.getByText('Contenido uno', { selector: 'p' })).not.toBeVisible();
    expect(screen.queryByRole('tabpanel', { name: 'Uno' })).not.toBeInTheDocument();
  });

  it('aplica las clases recibidas', () => {
    render(
      <Tabs
        label="X"
        tabs={items}
        value="uno"
        onChange={() => undefined}
        className="lista"
        tabClassName="ficha"
        panelClassName="cuerpo"
      />,
    );

    expect(screen.getByRole('tablist')).toHaveClass('lista');
    expect(tab('Uno')).toHaveClass('ficha');
    expect(screen.getByRole('tabpanel')).toHaveClass('cuerpo');
  });
});
