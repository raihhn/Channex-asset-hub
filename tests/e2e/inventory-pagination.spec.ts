import {expect,test} from '@playwright/test';

test('inventory pagination remains reachable above mobile navigation at the bottom of the page',async({page})=>{
  await page.goto('/assets');
  const more=page.getByRole('button',{name:/Show more assets \(24 of/});
  await expect(more).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  const nav=page.getByRole('navigation',{name:'Mobile primary navigation'});
  if(await nav.isVisible()){
    const buttonBox=await more.boundingBox();
    const navBox=await nav.boundingBox();
    expect(buttonBox!.y+buttonBox!.height).toBeLessThan(navBox!.y-8);
  }
  await more.click();
  await expect(page.locator('.inventory-results > article')).toHaveCount(48);
});
